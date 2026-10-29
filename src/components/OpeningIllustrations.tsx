/** Simple replaceable landscape placeholder; not a reproduction of the reference artwork. */
export function LandscapePlaceholder(){
 return <svg viewBox="0 0 700 460" role="img" aria-label="Green landscape and architectural houses, illustration placeholder">
 <defs><filter id="land-grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" seed="4" result="grain"/><feComposite in="grain" in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs>
 <g filter="url(#land-grain)">
 <path d="M30 220 160 155 270 220 140 285Z" fill="#83947a"/><path d="m140 160 150-75 160 80-150 75Z" fill="#365b46"/><path d="m310 240 150-75 190 95-150 75Z" fill="#94a58f"/><path d="m250 335 120-60 150 75-120 60Z" fill="#657169"/><path d="m420 100 120-60 120 60-120 60Z" fill="#83947a"/>
 {[{x:110,y:196,s:.8},{x:270,y:143,s:1.15},{x:460,y:242,s:1},{x:370,y:328,s:.65},{x:536,y:83,s:.6}].map(({x,y,s},i)=><g key={i} transform={`translate(${x} ${y}) scale(${s})`}><path d="M-30 10 0-8 30 10V57L0 74-30 57Z" fill="#fcfbf7"/><path d="M-38 12 0-28 38 12 0-7Z" fill="#26352e"/><path d="M0-7V74M-30 57 0 74 30 57" fill="none" stroke="#bfc3bc"/><path d="M-20 21-10 27V43L-20 37ZM10 27 20 21V37L10 43Z" fill="#dce2dc"/></g>)}
 </g></svg>;
}
export function HailIntroduction(){
 return <svg className="intro-hail" viewBox="0 0 1000 220" role="img" aria-label="Illustrative clouds with falling hail; not a storm forecast">
 <defs><filter id="hail-grain"><feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="2" seed="8" result="grain"/><feComposite in="grain" in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs>
 <g fill="#dce2dc" filter="url(#hail-grain)">{[0,330,660].map(x=><path key={x} transform={`translate(${x} 0)`} d="M0 66 25 41 66 34 93 11 139 17 166 42 209 22 249 32 277 56 315 61 330 80 287 97 240 90 197 107 151 93 102 100 55 84 22 85Z"/>)}</g>
 <g className="hail-fall">{Array.from({length:30},(_,i)=><path className="hail-stone" key={i} style={{animationDelay:`-${(i%5)*.38}s`}} transform={`translate(${20+i*33} ${90+(i%3)*24})`} d="m0-7 7 3 3 8-7 5-7-4Z" fill={i%2?'#bfc3bc':'#dce2dc'}/>)}</g>
 </svg>;
}
