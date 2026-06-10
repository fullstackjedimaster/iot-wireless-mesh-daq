"use client";

import { useEffect } from "react";

const SNAP = 8;
const MAX_HEIGHT = 4000;

export default function EmbedHeightReporter() {
  useEffect(() => {
    const getHeight = () => {
      const body = document.body;
      const html = document.documentElement;

      return Math.min(
        MAX_HEIGHT,
        Math.ceil(
          Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          ) / SNAP
        ) * SNAP
      );
    };

    const postHeight = () => {
      window.parent.postMessage(
        {
          type: "EMBED_HEIGHT",
          height: getHeight(),
        },
        "*"
      );
    };

    postHeight();

    const resizeObserver = new ResizeObserver(postHeight);
    resizeObserver.observe(document.body);
    resizeObserver.observe(document.documentElement);

    const mutationObserver = new MutationObserver(postHeight);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    window.addEventListener("load", postHeight);
    window.addEventListener("resize", postHeight);

    const interval = window.setInterval(postHeight, 750);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("load", postHeight);
      window.removeEventListener("resize", postHeight);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}