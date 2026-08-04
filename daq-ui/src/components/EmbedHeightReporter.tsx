"use client";
import { useEffect } from "react";

type Props = { contentRootId: string };
const MAX_HEIGHT=6000, THRESHOLD=1;
function parentOrigin(){ const q=new URLSearchParams(location.search).get("embedParentOrigin"); try{return q?new URL(q).origin:new URL(document.referrer).origin}catch{return ""} }
function naturalHeight(root:HTMLElement){
    const body=document.body, html=document.documentElement;
    return Math.min(MAX_HEIGHT,Math.max(1,Math.ceil(Math.max(root.getBoundingClientRect().bottom,root.scrollHeight,root.offsetHeight,body.scrollHeight,body.offsetHeight,html.scrollHeight,html.offsetHeight))));
}
export default function EmbedHeightReporter({contentRootId}:Props){
 useEffect(()=>{ if(parent===window)return; const root=document.getElementById(contentRootId); const origin=parentOrigin(); if(!(root instanceof HTMLElement)||!origin)return;
 let raf=0,last=0,dead=false; const report=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{if(dead)return; const height=naturalHeight(root); if(Math.abs(height-last)<THRESHOLD)return; last=height; parent.postMessage({type:"EMBED_HEIGHT",height},origin);});};
 const ro=new ResizeObserver(report), mo=new MutationObserver(report); ro.observe(root); ro.observe(document.body); mo.observe(root,{subtree:true,childList:true,characterData:true,attributes:true});
 const timers=[0,50,150,350,750].map(ms=>window.setTimeout(report,ms)); addEventListener("load",report); addEventListener("resize",report); addEventListener("rag-dock-resize",report);
 return()=>{dead=true;cancelAnimationFrame(raf);timers.forEach(clearTimeout);ro.disconnect();mo.disconnect();removeEventListener("load",report);removeEventListener("resize",report);removeEventListener("rag-dock-resize",report)};
 },[contentRootId]); return null;
}
