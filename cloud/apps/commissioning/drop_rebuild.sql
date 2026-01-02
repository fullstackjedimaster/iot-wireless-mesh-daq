CREATE TABLE IF NOT EXISTS ec.entity_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  template JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_config_schema_entity_idx
  ON ec.entity_config (lower(schema_name), lower(entity_name));

 

-- 2. Insert/update function with full JSON payload (meta-wrapped)
CREATE OR REPLACE FUNCTION ec.insert_template(
  schema_name TEXT,
  entity_name TEXT,
  template    JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF schema_name IS NULL OR trim(schema_name) = '' THEN
    RAISE EXCEPTION 'insert_template: schema_name is required';
  END IF;

  IF entity_name IS NULL OR trim(entity_name) = '' THEN
    RAISE EXCEPTION 'insert_template: entity_name is required';
  END IF;

  IF template IS NULL OR template::text = '{}' THEN
    RAISE EXCEPTION 'insert_template: template must be a non-empty JSON object';
  END IF;

  INSERT INTO ec.entity_config (schema_name, entity_name, template)
  VALUES (schema_name, entity_name, template)
  ON CONFLICT (entity_name)
  DO UPDATE SET template = EXCLUDED.template;
END;
$$;

ALTER FUNCTION ec.insert_template(TEXT, TEXT, JSONB) OWNER TO ec;


CREATE OR REPLACE FUNCTION ec.get_entity_template(
  schema_name TEXT,
  entity_name TEXT,
  template TEXT
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT t.template INTO result
  FROM ec.entity_config t
  WHERE t.entity_name = get_table_name(entity_name)
    AND t.json_column = json_column;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ec.get_column_options(
  _schema_name TEXT,
  _entity_name TEXT,
  _column_name TEXT,
  _filter TEXT DEFAULT NULL
)
RETURNS TABLE (value TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  tmpl JSONB;
BEGIN
  -- Fetch template for schema + entity
  SELECT template INTO tmpl
  FROM ec.entity_config
  WHERE schema_name = _schema_name AND entity_name = _entity_name;

  IF tmpl IS NULL THEN
    RAISE EXCEPTION 'No template found for %.%', _schema_name, _entity_name;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT DISTINCT j->>%L AS value
     FROM jsonb_array_elements($1->''template''->%L->%L) AS j
     WHERE j->>%L IS NOT NULL %s
     ORDER BY value',
     _column_name, _entity_name, _column_name, _column_name,
     CASE WHEN _filter IS NOT NULL THEN
       format('AND j->>%L ILIKE ''%%%s%%''', _column_name, _filter)
     ELSE
       ''
     END
  ) USING tmpl;
END;
$$;

CREATE OR REPLACE FUNCTION ec.get_form_metadata(
  _schema_name TEXT,
  _entity_name TEXT
)
RETURNS TABLE (template JSONB)
LANGUAGE sql AS $$
  SELECT template
  FROM ec.entity_config
  WHERE schema_name = _schema_name AND entity_name = _entity_name;
$$;


CREATE OR REPLACE FUNCTION ec.manage_entity(
  operation text,
  entity_name text,
  id uuid DEFAULT NULL,
  data json DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  result json;
  cfg RECORD;
  col RECORD;
  col_names text := '';
  col_values text := '';
  update_pairs text := '';
  query text;
  zero_uuid constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  target_schema text := lower(NULLIF(data->>'__schema',''));
  table_name text := entity_name;
BEGIN
  operation := lower(coalesce(operation,''));
  entity_name := lower(coalesce(entity_name,''));

  -- Fetch matching entity config from ec.entity_config
  IF target_schema IS NOT NULL THEN
    SELECT * INTO cfg
    FROM ec.entity_config
    WHERE lower(entity_name) = entity_name AND lower(schema_name) = target_schema;
  ELSE
    SELECT * INTO cfg
    FROM ec.entity_config
    WHERE lower(entity_name) = entity_name
    ORDER BY schema_name
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No config found for entity_name=%, schema=%', entity_name, target_schema;
  END IF;

  -- CREATE
  IF operation = 'create' THEN
    FOR col IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = cfg.schema_name
        AND table_name = table_name
        AND column_name <> 'id'
        AND column_name NOT IN ('last_updated_at', 'last_updated_by')
      ORDER BY ordinal_position
    LOOP
      col_names := col_names || format('%I, ', col.column_name);
      col_values := col_values || COALESCE(
        CASE col.data_type
          WHEN 'uuid'                          THEN format('%L::uuid',        data->>col.column_name)
          WHEN 'integer'                       THEN format('%L::int',         data->>col.column_name)
          WHEN 'bigint'                        THEN format('%L::bigint',      data->>col.column_name)
          WHEN 'numeric'                       THEN format('%L::numeric',     data->>col.column_name)
          WHEN 'boolean'                       THEN format('%L::boolean',     data->>col.column_name)
          WHEN 'json'                          THEN format('%L::json',        data->>col.column_name)
          WHEN 'jsonb'                         THEN format('%L::jsonb',       data->>col.column_name)
          WHEN 'date'                          THEN format('%L::date',        data->>col.column_name)
          WHEN 'timestamp without time zone'   THEN format('%L::timestamp',   data->>col.column_name)
          WHEN 'timestamp with time zone'      THEN format('%L::timestamptz', data->>col.column_name)
          WHEN 'citext'                        THEN format('%L::citext',      data->>col.column_name)
          ELSE                                       format('%L',              data->>col.column_name)
        END, 'NULL'
      ) || ', ';
    END LOOP;

    IF col_names = '' THEN
      query := format(
        'INSERT INTO %I.%I DEFAULT VALUES RETURNING to_jsonb(%I.*)',
        cfg.schema_name, table_name, table_name
      );
    ELSE
      col_names := left(col_names, length(col_names) - 2);
      col_values := left(col_values, length(col_values) - 2);
      query := format(
        'INSERT INTO %I.%I (%s) VALUES (%s) RETURNING to_jsonb(%I.*)',
        cfg.schema_name, table_name, col_names, col_values, table_name
      );
    END IF;
    EXECUTE query INTO result;

  -- READ
  ELSIF operation = 'read' THEN
    IF id IS NULL OR id = zero_uuid THEN
      query := format(
        'SELECT COALESCE(json_agg(to_jsonb(t.*)), ''[]''::json) FROM %I.%I t',
        cfg.schema_name, table_name
      );
    ELSE
      query := format(
        'SELECT to_jsonb(t.*) FROM %I.%I t WHERE id = %L::uuid',
        cfg.schema_name, table_name, id::text
      );
    END IF;
    EXECUTE query INTO result;

  -- LIST / SELECT
  ELSIF operation IN ('list', 'select') THEN
    query := format(
      'SELECT COALESCE(json_agg(to_jsonb(t.*)), ''[]''::json) FROM %I.%I t',
      cfg.schema_name, table_name
    );
    EXECUTE query INTO result;

  -- UPDATE
  ELSIF operation = 'update' THEN
    IF id IS NULL OR id = zero_uuid THEN
      RAISE EXCEPTION 'update requires a valid id';
    END IF;

    FOR col IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = cfg.schema_name
        AND table_name = table_name
        AND column_name <> 'id'
        AND column_name NOT IN ('last_updated_at', 'last_updated_by')
      ORDER BY ordinal_position
    LOOP
      update_pairs := update_pairs || format('%I = ', col.column_name) || COALESCE(
        CASE col.data_type
          WHEN 'uuid'                          THEN format('%L::uuid',        data->>col.column_name)
          WHEN 'integer'                       THEN format('%L::int',         data->>col.column_name)
          WHEN 'bigint'                        THEN format('%L::bigint',      data->>col.column_name)
          WHEN 'numeric'                       THEN format('%L::numeric',     data->>col.column_name)
          WHEN 'boolean'                       THEN format('%L::boolean',     data->>col.column_name)
          WHEN 'json'                          THEN format('%L::json',        data->>col.column_name)
          WHEN 'jsonb'                         THEN format('%L::jsonb',       data->>col.column_name)
          WHEN 'date'                          THEN format('%L::date',        data->>col.column_name)
          WHEN 'timestamp without time zone'   THEN format('%L::timestamp',   data->>col.column_name)
          WHEN 'timestamp with time zone'      THEN format('%L::timestamptz', data->>col.column_name)
          WHEN 'citext'                        THEN format('%L::citext',      data->>col.column_name)
          ELSE                                       format('%L',              data->>col.column_name)
        END, 'NULL'
      ) || ', ';
    END LOOP;

    update_pairs := left(update_pairs, length(update_pairs) - 2);
    query := format(
      'UPDATE %I.%I SET %s WHERE id = %L::uuid RETURNING to_jsonb(%I.*)',
      cfg.schema_name, table_name, update_pairs, id::text, table_name
    );
    EXECUTE query INTO result;

  -- DELETE
  ELSIF operation = 'delete' THEN
    IF id IS NULL OR id = zero_uuid THEN
      RAISE EXCEPTION 'delete requires a valid id';
    END IF;
    query := format(
      'DELETE FROM %I.%I WHERE id = %L::uuid RETURNING to_jsonb(%I.*)',
      cfg.schema_name, table_name, id::text, table_name
    );
    EXECUTE query INTO result;

  -- Unsupported
  ELSE
    RAISE EXCEPTION 'Unsupported operation: %', operation;
  END IF;

  RETURN result;
END;
$$;

ALTER FUNCTION ec.manage_entity(text, text, uuid, json) OWNER TO ec;


  -- ================================================================
-- ec.seed_schema
--   Creates a new tenant schema, baseline tables, and root data
-- ================================================================
CREATE OR REPLACE FUNCTION ec.seed_schema(
    p_schema text,
    p_sub text,
    p_email text,
    p_name text DEFAULT NULL,
    p_picture text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_root_org_id uuid;
    v_user_id uuid;
BEGIN
    p_schema := lower(trim(p_schema));

    -- 1️⃣ Create schema if missing
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION CURRENT_USER', p_schema);

    -- 2️⃣ Create tables (if missing)
    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS %1$I.organization (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            org_key text UNIQUE NOT NULL,
            name text NOT NULL,
            parent_org_id uuid NULL REFERENCES %1$I.organization(id),
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS %1$I."user" (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            auth0_sub text UNIQUE NOT NULL,
            email text NOT NULL,
            name text,
            picture_url text,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS %1$I.role (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            org_id uuid REFERENCES %1$I.organization(id) ON DELETE CASCADE,
            key text NOT NULL,
            name text NOT NULL,
            description text,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            UNIQUE (org_id, key)
        );
        CREATE TABLE IF NOT EXISTS %1$I.permission (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            key text UNIQUE NOT NULL,
            description text,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS %1$I.user_org (
            user_id uuid REFERENCES %1$I."user"(id) ON DELETE CASCADE,
            org_id uuid REFERENCES %1$I.organization(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, org_id)
        );
        CREATE TABLE IF NOT EXISTS %1$I.user_org_role (
            user_id uuid REFERENCES %1$I."user"(id) ON DELETE CASCADE,
            org_id uuid REFERENCES %1$I.organization(id) ON DELETE CASCADE,
            role_id uuid REFERENCES %1$I.role(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, org_id, role_id)
        );
        CREATE TABLE IF NOT EXISTS %1$I.role_permission (
            role_id uuid REFERENCES %1$I.role(id) ON DELETE CASCADE,
            permission_id uuid REFERENCES %1$I.permission(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        );
    $ddl$, p_schema);

    -- 3️⃣ Insert baseline permissions
    EXECUTE format($ins$
        INSERT INTO %1$I.permission (key, description)
        VALUES
            ('crud:create', 'Create records'),
            ('crud:read',   'Read records'),
            ('crud:update', 'Update records'),
            ('crud:delete', 'Delete records')
        ON CONFLICT (key) DO NOTHING;
    $ins$, p_schema);

    -- 4️⃣ Insert baseline roles
    EXECUTE format($ins$
        INSERT INTO %1$I.role (id, org_id, key, name, description)
        VALUES
            (uuid_generate_v4(), NULL, 'creator', 'Creator', 'Full access to tenant data'),
            (uuid_generate_v4(), NULL, 'editor',  'Editor',  'Modify records'),
            (uuid_generate_v4(), NULL, 'viewer',  'Viewer',  'Read-only access')
        ON CONFLICT DO NOTHING;
    $ins$, p_schema);

    -- 5️⃣ Map roles → permissions
    EXECUTE format($map$
        INSERT INTO %1$I.role_permission (role_id, permission_id)
        SELECT r.id, p.id
          FROM %1$I.role r, %1$I.permission p
         WHERE (r.key = 'creator')
            OR (r.key = 'editor' AND p.key IN ('crud:read','crud:update'))
            OR (r.key = 'viewer' AND p.key = 'crud:read')
        ON CONFLICT DO NOTHING;
    $map$, p_schema);

    -- 6️⃣ Create root organization
    EXECUTE format($ins$
        INSERT INTO %1$I.organization (org_key, name)
        VALUES (%2$L, %2$L)
        ON CONFLICT (org_key) DO NOTHING;
    $ins$, p_schema, p_schema);

    EXECUTE format('SELECT id FROM %I.organization WHERE org_key = %L', p_schema, p_schema)
    INTO v_root_org_id;

    -- 7️⃣ Insert initial user
    EXECUTE format($user$
        INSERT INTO %1$I."user" (auth0_sub, email, name, picture_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (auth0_sub) DO UPDATE
          SET email=$2, name=$3, picture_url=$4, updated_at=now()
        RETURNING id;
    $user$, p_schema)
    USING p_sub, p_email, p_name, p_picture
    INTO v_user_id;

    -- 8️⃣ Link user → org → role (creator)
    EXECUTE format($link$
        INSERT INTO %1$I.user_org (user_id, org_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
    $link$, p_schema)
    USING v_user_id, v_root_org_id;

    EXECUTE format($r$
        INSERT INTO %1$I.user_org_role (user_id, org_id, role_id)
        SELECT $1, $2, r.id FROM %1$I.role r
         WHERE r.key = 'creator' LIMIT 1
        ON CONFLICT DO NOTHING;
    $r$, p_schema)
    USING v_user_id, v_root_org_id;

    -- ✅ Return summary JSON
    RETURN jsonb_build_object(
        'schema', p_schema,
        'root_org_id', v_root_org_id,
        'user_id', v_user_id,
        'roles_seeded', 3,
        'permissions_seeded', 4
    );
END;
$$;



CREATE OR REPLACE FUNCTION ec.provision_user_and_orgs(
  p_schema     text,
  p_sub        text,
  p_email      text,
  p_name       text DEFAULT NULL,
  p_picture    text DEFAULT NULL,
  p_given      text DEFAULT NULL,
  p_family     text DEFAULT NULL,
  p_locale     text DEFAULT NULL,
  -- memberships: [{org_key:"acme", parent_key:null, roles:["creator","editor"]}, {...}]
  p_memberships jsonb DEFAULT '[]'::jsonb,
  -- global permissions (schema-wide)
  p_permissions text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_sql text;
  v_user jsonb;
  v_org_key text;
  v_parent_key text;
  v_roles text[];
  v_org_id uuid;
  v_parent_id uuid;
  v_root_id uuid;
  v_item jsonb;
BEGIN
  p_schema := coalesce(nullif(trim(p_schema), ''), 'public');
  p_email  := lower(p_email);

  -- 1) Ensure schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION CURRENT_USER', p_schema);

  -- 2) Ensure root org (org_key = schema)
  EXECUTE format($fmt$
    INSERT INTO %1$I.organization (org_key, name)
    VALUES (%2$L, %2$L)
    ON CONFLICT (org_key) DO NOTHING;
  $fmt$, p_schema, p_schema);

  -- Lookup root id
  EXECUTE format('SELECT id FROM %I.organization WHERE org_key = %L', p_schema, p_schema)
  INTO v_root_id;

  -- 3) Upsert user (no org coupling here)
  v_sql := format($fmt$
    INSERT INTO %1$I."user" (auth0_sub, email, name, picture_url, given_name, family_name, locale, last_login_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
    ON CONFLICT (auth0_sub) DO UPDATE
      SET email=$2, name=$3, picture_url=$4, given_name=$5, family_name=$6, locale=$7, last_login_at=now(), updated_at=now()
    RETURNING id;
  $fmt$, p_schema);
  EXECUTE v_sql
    USING p_sub, p_email, p_name, p_picture, p_given, p_family, p_locale
    INTO v_user_id;

  -- 4) Global permission upserts (schema-wide)
  IF array_length(p_permissions,1) IS NOT NULL THEN
    EXECUTE format($fmt$
      INSERT INTO %1$I.permission (key, description, updated_at)
      SELECT DISTINCT p, NULL, now() FROM unnest($1::text[]) p
      ON CONFLICT (key) DO UPDATE SET updated_at=now();
    $fmt$, p_schema)
    USING p_permissions;
  END IF;

  -- 5) Iterate memberships (orgs + roles)
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_memberships,'[]'::jsonb))
  LOOP
    v_org_key    := coalesce((v_item->>'org_key'), p_schema); -- default root
    v_parent_key := NULLIF(trim(v_item->>'parent_key'), '');
    v_roles      := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_item->'roles','[]'::jsonb)));

    -- 5.1 Ensure parent org first (if any)
    IF v_parent_key IS NOT NULL THEN
      -- upsert parent
      EXECUTE format($fmt$
        INSERT INTO %1$I.organization (org_key, name)
        VALUES (%2$L, %2$L)
        ON CONFLICT (org_key) DO NOTHING;
      $fmt$, p_schema, v_parent_key);
      EXECUTE format('SELECT id FROM %I.organization WHERE org_key = %L', p_schema, v_parent_key)
      INTO v_parent_id;
    ELSE
      v_parent_id := v_root_id;
    END IF;

    -- 5.2 Upsert org and set its parent (if new)
    EXECUTE format($fmt$
      INSERT INTO %1$I.organization (org_key, name, parent_org_id)
      VALUES (%2$L, %2$L, %3$L)
      ON CONFLICT (org_key) DO UPDATE
        SET parent_org_id = COALESCE(%3$L, %1$I.organization.parent_org_id),
            updated_at = now();
    $fmt$, p_schema, v_org_key, v_parent_id);

    EXECUTE format('SELECT id FROM %I.organization WHERE org_key = %L', p_schema, v_org_key)
    INTO v_org_id;

    -- 5.3 Ensure membership (user ↔ org)
    EXECUTE format($fmt$
      INSERT INTO %1$I.user_org (user_id, org_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING;
    $fmt$, p_schema)
    USING v_user_id, v_org_id;

    -- 5.4 Upsert roles for this org
    IF array_length(v_roles,1) IS NOT NULL THEN
      EXECUTE format($fmt$
        INSERT INTO %1$I.role (org_id, key, name, description, updated_at)
        SELECT $1, r, r, NULL, now() FROM unnest($2::text[]) r
        ON CONFLICT (org_id, key) DO UPDATE SET updated_at=now();
      $fmt$, p_schema)
      USING v_org_id, v_roles;

      -- 5.5 Link user ↔ org ↔ roles (many)
      EXECUTE format($fmt$
        INSERT INTO %1$I.user_org_role (user_id, org_id, role_id)
        SELECT $1, $2, r.id
          FROM %1$I.role r
         WHERE r.org_id = $2 AND r.key = ANY($3::text[])
        ON CONFLICT DO NOTHING;
      $fmt$, p_schema)
      USING v_user_id, v_org_id, v_roles;
    END IF;

    -- 5.6 (Optional) Map new roles to global permissions if you like:
    -- INSERT INTO :"app_schema".role_permission ...
  END LOOP;

  -- 6) Return full user row JSON
  v_sql := format($fmt$
    WITH roles_by_org AS (
      SELECT uor.user_id, o.org_key, array_agg(DISTINCT r.key ORDER BY r.key) AS roles
        FROM %1$I.user_org_role uor
        JOIN %1$I.role r ON r.id = uor.role_id
        JOIN %1$I.organization o ON o.id = uor.org_id
       GROUP BY uor.user_id, o.org_key
    )
    SELECT jsonb_build_object(
      'id', u.id,
      'auth0_sub', u.auth0_sub,
      'email', u.email,
      'name', u.name,
      'memberships', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('org_key', org_key, 'roles', roles))
           FROM roles_by_org rb WHERE rb.user_id = u.id),
        '[]'::jsonb
      )
    )
    FROM %1$I."user" u
   WHERE u.id = $1;
  $fmt$, p_schema);

  EXECUTE v_sql USING v_user_id INTO v_user;
  RETURN v_user;
END;
$$;

CREATE OR REPLACE FUNCTION ec.create_entity_from_template(_schema TEXT, _entity TEXT, _template JSONB )
RETURNS VOID
LANGUAGE plpgsql
AS
$$
DECLARE k TEXT;
v JSONB;
coltype TEXT;
has_table BOOLEAN;
BEGIN 

	SELECT EXISTS ( SELECT 1
		FROM information_schema.tables
		WHERE table_schema = _schema
		AND table_name = _entity )
		INTO has_table;
		
	IF NOT has_table THEN
     		EXECUTE format( 'CREATE TABLE %I.%I ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(),
			 updated_at timestamptz DEFAULT now() )', _schema, _entity);
     	END IF; 
     	FOR k, v IN SELECT key, value FROM jsonb_each(_template -> _entity)
     	    LOOP 
     	    	coltype := CASE jsonb_typeof(v)
     	    			WHEN 'number' THEN 'numeric'
     	    			WHEN 'boolean' THEN 'boolean'
     	    			WHEN 'object' THEN 'jsonb' 
     	    			WHEN 'array' THEN 'jsonb'
     	    			ELSE 'text'
     	    		  END;
     		IF NOT EXISTS ( SELECT 1
     				FROM information_schema.columns
     				WHERE table_schema = _schema
     				AND table_name = _entity 
     				AND column_name = k ) THEN
     			EXECUTE format('ALTER TABLE %I.%I ADD COLUMN %I %s', _schema, _entity, k, coltype);
     		END IF; 
     	   END LOOP; 
	PERFORM ec.insert_template(_schema, _entity, _template);
END; 
$$;

ALTER FUNCTION ec.create_entity_from_template(TEXT, TEXT, JSONB) OWNER TO ec;