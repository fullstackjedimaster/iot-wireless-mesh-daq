import subprocess

WKHTMLPDF_BIN = '/opt/wkhtmlpdf/wkhtmltopdf'

def create_pdf(html, *switches):
    switches = list(switches) + ['--page-size', 'Letter']
    args = switches + ['-', '-']
    cmd = [WKHTMLPDF_BIN] + args

    proc = subprocess.Popen(cmd,
                            stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    proc.stdin.write(html)
    proc.stdin.close()

    proc.wait()

    data = proc.stdout.read()

    return data, proc.returncode
