// The stylesheet, as a string the component injects once: no bundler setting is needed to load it. It follows your theme through CSS variables (--background-card, --foreground, --border...
// with sensible fallbacks); override any --rokp-* variable on a parent to restyle it.
export const STYLES = `
.rokp{--rokp-bg:var(--background-card,#141a20);--rokp-bg2:var(--background-secondary,#0f151b);--rokp-hover:var(--background-hover,#1e2630);--rokp-fg:var(--foreground,#e6edf3);--rokp-muted:var(--text-muted,#8c98a4);--rokp-border:var(--border,rgba(255,255,255,.14));--rokp-primary:var(--primary,#4318ff);--rokp-ok:#2f9e44;--rokp-bad:#e5484d;--rokp-warn:#f0883e;
position:relative;display:flex;width:100%;height:100%;min-height:560px;color:var(--rokp-fg);background:var(--rokp-bg2);font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;border:1px solid var(--rokp-border);border-radius:12px;overflow:hidden;outline:none}
.rokp *,.rokp *::before,.rokp *::after{box-sizing:border-box}
.rokp button{font:inherit;color:inherit;background:var(--rokp-bg);border:1px solid var(--rokp-border);border-radius:7px;padding:5px 11px;cursor:pointer;min-height:30px}
.rokp button:hover:not(:disabled){background:var(--rokp-hover)}
.rokp button:disabled{opacity:.45;cursor:default}
.rokp button.on{background:var(--rokp-primary);border-color:var(--rokp-primary);color:#fff}
.rokp button.rokp-primary{background:var(--rokp-primary);border-color:var(--rokp-primary);color:#fff}
.rokp button.rokp-primary:hover:not(:disabled){filter:brightness(1.12);background:var(--rokp-primary)}
.rokp button.rokp-danger{color:var(--rokp-bad);border-color:rgba(229,72,77,.5);margin-top:8px}
.rokp button.rokp-link{background:none;border:0;padding:0;min-height:0;color:var(--rokp-primary);text-decoration:underline}
.rokp input,.rokp select{font:inherit;color:inherit}
.rokp-input,.rokp-select{background:var(--rokp-bg2);border:1px solid var(--rokp-border);border-radius:7px;padding:5px 8px;min-height:30px;min-width:0;max-width:100%}
.rokp-num{width:72px}
.rokp-color{width:30px;height:26px;padding:0;border:1px solid var(--rokp-border);border-radius:6px;background:none;cursor:pointer}
.rokp-grow{flex:1;min-width:0}
.rokp-row{display:flex;gap:6px;align-items:center;margin:6px 0}
.rokp-wrap{flex-wrap:wrap}

.rokp-side{width:350px;flex:none;overflow:auto;background:var(--rokp-bg);border-right:1px solid var(--rokp-border);padding:4px 12px 28px;z-index:6}
.rokp-side.closed{display:none}
.rokp-main{position:relative;flex:1;min-width:0;background:#0b0f13}
.rokp-map{position:absolute;inset:0;overflow:hidden;background:#0b0f13}
.rokp-map canvas{position:absolute;left:0;top:0;display:block}
.rokp-map .rokp-base,.rokp-map .rokp-under{transform-origin:0 0;pointer-events:none;will-change:transform}
.rokp-map .rokp-base,.rokp-map .rokp-top{width:100%;height:100%}
.rokp-map .rokp-top{touch-action:none}
.rokp-cur-view{cursor:grab}.rokp-cur-place{cursor:crosshair}.rokp-cur-erase{cursor:not-allowed}
.rokp-readout{position:absolute;left:10px;bottom:10px;background:rgba(14,19,24,.88);color:#e6edf3;border-radius:6px;padding:3px 9px;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none}
.rokp-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--rokp-muted);padding:20px;text-align:center}
.rokp-bad{color:var(--rokp-bad)}

.rokp-bar{position:absolute;left:10px;top:10px;display:flex;gap:5px;align-items:center;flex-wrap:wrap;max-width:calc(100% - 70px);background:rgba(14,19,24,.9);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:5px;z-index:4;color:#e6edf3}
.rokp-bar button{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:#e6edf3;padding:4px 10px}
.rokp-bar button:hover:not(:disabled){background:rgba(255,255,255,.14)}
.rokp-bar button.on{background:var(--rokp-primary);border-color:var(--rokp-primary)}
.rokp-sep{width:1px;align-self:stretch;background:rgba(255,255,255,.16);margin:2px 2px}
.rokp-for{display:flex;align-items:center;gap:6px}
.rokp-for select{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#e6edf3;border-radius:6px;padding:3px 6px;max-width:170px}
.rokp-for select option{color:#111}
.rokp-sidebtn{padding:4px 9px}
.rokp-zoom{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:4px;z-index:4}
.rokp-zoom button{width:34px;height:34px;padding:0;font-size:18px;background:rgba(14,19,24,.9);border-color:rgba(255,255,255,.18);color:#e6edf3}
.rokp-banner{position:absolute;left:50%;top:56px;transform:translateX(-50%);background:rgba(240,136,62,.95);color:#1a1005;padding:5px 14px;border-radius:8px;font-weight:600;z-index:5;max-width:90%;text-align:center}
.rokp-tip{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);background:rgba(14,19,24,.88);color:#cdd6de;padding:4px 12px;border-radius:999px;font-size:12px;pointer-events:none;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis}
.rokp-toasts{position:absolute;left:50%;top:58px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center;z-index:7;width:min(560px,92%);pointer-events:none}
.rokp-toast{background:rgba(14,19,24,.96);color:#fff;border:1.5px solid rgba(255,255,255,.3);border-radius:9px;padding:7px 13px;box-shadow:0 4px 16px rgba(0,0,0,.45);text-align:center}
.rokp-toast.error{border-color:#f85149;background:rgba(60,14,16,.97)}
.rokp-toast.warn{border-color:#f0883e}
.rokp-toast.ok{border-color:#3fb950}
.rokp-card{position:absolute;right:56px;bottom:12px;width:290px;background:rgba(14,19,24,.95);color:#e6edf3;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:10px 12px;z-index:4}
.rokp-card b{display:block;margin-bottom:3px;padding-right:18px}
.rokp-card div{color:#b6c0ca;font-size:12.5px}
.rokp-x{position:absolute;right:6px;top:4px;background:none!important;border:0!important;font-size:18px;line-height:1;padding:0 6px!important;min-height:0!important}

.rokp-sec{border-top:1px solid var(--rokp-border);margin-top:4px}
.rokp-sec:first-child{border-top:0}
.rokp-sec-h{display:flex;width:100%;align-items:center;gap:6px;background:none!important;border:0!important;padding:9px 2px!important;text-align:left;font-weight:700;font-size:12.5px;letter-spacing:.03em;text-transform:uppercase;color:var(--rokp-muted)}
.rokp-sec-t{flex:1}
.rokp-caret{width:12px;font-size:11px}
.rokp-badge{background:var(--rokp-bg2);border:1px solid var(--rokp-border);border-radius:999px;padding:0 7px;font-size:11px;font-weight:600;text-transform:none;letter-spacing:0;color:var(--rokp-fg)}
.rokp-sec-b{padding:0 2px 12px}
.rokp-hint{color:var(--rokp-muted);font-size:12.5px;margin:4px 0 8px}
.rokp-sub{color:var(--rokp-muted);font-size:12px;margin:3px 0}
.rokp-label{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--rokp-muted);margin:10px 0 4px}
.rokp-box{background:var(--rokp-bg2);border:1px solid var(--rokp-border);border-radius:9px;padding:8px 10px;margin:8px 0}
.rokp-check{display:flex;align-items:flex-start;gap:8px;margin:5px 0;cursor:pointer}
.rokp-check.rokp-off{opacity:.5;cursor:default}
.rokp-check input{margin-top:3px;accent-color:var(--rokp-primary)}
.rokp-check-t small{display:block;color:var(--rokp-muted);font-size:11.8px;line-height:1.35}
.rokp-sw{display:inline-block;width:13px;height:13px;border-radius:3px;border:1px solid rgba(0,0,0,.4);flex:none;margin-top:2px;vertical-align:middle}
.rokp-icon{display:block;flex:none}
.rokp-dot{display:inline-block;border-radius:50%;flex:none}
.rokp-pill{font-size:11.5px;font-weight:600;border:1px solid var(--rokp-border);border-radius:999px;padding:2px 9px;white-space:nowrap;color:var(--rokp-muted)}
.rokp-pill.ok{color:var(--rokp-ok);border-color:var(--rokp-ok)}
.rokp-pill.bad{color:var(--rokp-bad);border-color:var(--rokp-bad)}
.rokp-msg{border:1px solid var(--rokp-border);border-radius:9px;padding:8px 10px;margin:8px 0}
.rokp-msg p{margin:0 0 6px}
.rokp-msg.ok{border-color:var(--rokp-ok)}
.rokp-msg.bad{border-color:var(--rokp-bad)}
.rokp-seg{display:flex;gap:0;border:1px solid var(--rokp-border);border-radius:8px;overflow:hidden}
.rokp-seg button{flex:1;border:0;border-radius:0;border-right:1px solid var(--rokp-border)}
.rokp-seg button:last-child{border-right:0}
.rokp-list{list-style:none;margin:6px 0;padding:0}
.rokp-list li{margin:0}
.rokp-list li>button{display:flex;width:100%;align-items:center;gap:8px;text-align:left;margin:2px 0;border-color:transparent;background:none}
.rokp-list li.on>button{background:var(--rokp-hover);border-color:var(--rokp-primary)}
.rokp-list small{color:var(--rokp-muted)}
.rokp-scroll{max-height:260px;overflow:auto}
.rokp-tag{font-size:10.5px;border:1px solid var(--rokp-border);border-radius:999px;padding:0 6px;color:var(--rokp-muted)}
.rokp-alliances{list-style:none;margin:6px 0;padding:0}
.rokp-ally{border:1px solid var(--rokp-border);border-left:5px solid #888;border-radius:9px;padding:6px 8px;margin:7px 0;background:var(--rokp-bg2)}
.rokp-ally.on{border-color:var(--rokp-primary);box-shadow:0 0 0 1px var(--rokp-primary) inset}
.rokp-ally.dim{opacity:.6}
.rokp-ally input[type=radio]{accent-color:var(--rokp-primary)}
.rokp-ico{padding:2px 8px!important;min-height:26px!important;min-width:28px}
.rokp-nodechip{display:inline-flex;align-items:center;gap:4px;background:var(--rokp-bg2);border:1px solid var(--rokp-border);border-radius:999px;padding:2px 9px 2px 5px}
.rokp-addeddot{display:inline-block;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid var(--rokp-primary);flex:none;align-self:center}
.rokp-modal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,8,12,.55);z-index:8;padding:16px}
.rokp-modal-box{position:relative;width:min(380px,100%);background:var(--rokp-bg);color:var(--rokp-fg);border:1px solid var(--rokp-border);border-radius:12px;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.rokp-modal-box>b{display:block;font-size:15px;margin-bottom:4px;padding-right:20px}
.rokp-drops{list-style:none;margin:6px 0;padding:0}
.rokp-drops li{display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px solid var(--rokp-border)}
.rokp-drops li:first-child{border-top:0}
.rokp-drops button{padding:3px 8px;min-height:26px}
.rokp-drops small{display:block;color:var(--rokp-muted);font-size:11.5px;margin-top:2px}
.rokp-droprank{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#ffd43b;color:#1a1405;font-weight:800;font-size:11px;flex:none}
.rokp-dropnodes{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.rokp-dropnodes .rokp-nodechip{padding:0 7px 0 3px;font-size:12px}
.rokp-chips{display:flex;flex-direction:column;gap:6px;margin:6px 0}
.rokp-chiprow{display:flex;gap:6px}
.rokp-chip{display:flex;align-items:center;gap:9px;flex:1;text-align:left;min-width:0}
.rokp-chip:not(.on){opacity:.5}
.rokp-chip.on{background:var(--rokp-hover)!important;border-color:var(--rokp-primary)!important;color:inherit!important}
.rokp-n{color:var(--rokp-muted);font-variant-numeric:tabular-nums}
.rokp-only{color:var(--rokp-muted)}
.rokp-slider{display:flex;align-items:center;gap:8px;margin:6px 0}
.rokp-slider>span:first-child{width:74px;flex:none;color:var(--rokp-muted)}
.rokp-slider>span:last-child{width:62px;text-align:right;flex:none;font-variant-numeric:tabular-nums}
.rokp-slider input{flex:1;min-width:0;accent-color:var(--rokp-primary)}
.rokp-pin{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;color:#fff;font-weight:800;font-size:11px;flex:none}
.rokp-stats{list-style:none;margin:0 0 8px;padding:0}
.rokp-stats li{margin:2px 0;display:flex;gap:8px;flex-wrap:wrap}
.rokp-foot{color:var(--rokp-muted);font-size:11.5px;margin:14px 2px 0}

@media (max-width:820px){
.rokp{min-height:520px}
.rokp-side{position:absolute;left:0;top:0;bottom:0;width:min(92%,380px);box-shadow:6px 0 24px rgba(0,0,0,.5)}
.rokp-bar{max-width:calc(100% - 20px)}
.rokp-zoom{top:auto;bottom:44px}
.rokp-card{right:56px;bottom:44px;width:min(290px,calc(100% - 70px))}
.rokp-tip{display:none}
}
`;
