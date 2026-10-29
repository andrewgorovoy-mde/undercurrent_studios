/** Percentage of the fixed, aligned current scene revealed, independent of viewport. */
export function revealPosition(clientX:number,left:number,width:number){return width<=0?50:Math.max(0,Math.min(100,(clientX-left)/width*100))}
