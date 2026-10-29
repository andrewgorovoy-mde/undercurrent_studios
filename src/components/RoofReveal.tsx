import {useState, type KeyboardEvent, type PointerEvent} from 'react';
import {House} from './House';
import {revealPosition} from '../utils/reveal';
interface Props {stories:string;material:string;storm:number;currentDamage:number;upgradedDamage:number}
export function RoofReveal({stories,material,storm,currentDamage,upgradedDamage}:Props){
  const [position,setPosition]=useState(50);
  function move(event:PointerEvent<HTMLDivElement>){
    const rect=event.currentTarget.getBoundingClientRect();
    setPosition(revealPosition(event.clientX,rect.left,rect.width));
  }
  function key(event:KeyboardEvent<HTMLDivElement>){
    const delta:Record<string,number>={ArrowLeft:-5,ArrowRight:5,ArrowDown:-5,ArrowUp:5,PageDown:-10,PageUp:10};
    if(event.key==='Home'){event.preventDefault();setPosition(0)}
    else if(event.key==='End'){event.preventDefault();setPosition(100)}
    else if(event.key in delta){event.preventDefault();setPosition(p=>Math.max(0,Math.min(100,p+delta[event.key])))}
  }
  return <div className="reveal-wrap">
    <div className="reveal-labels"><span>Keep your current roof</span><span>Upgrade to FORTIFIED</span></div>
    <div className="roof-reveal" role="slider" tabIndex={0} aria-label="Reveal current roof versus FORTIFIED roof" aria-valuemin={0} aria-valuemax={100} aria-valuenow={position} aria-valuetext={`${Math.round(position)}% current roof, ${Math.round(100-position)}% FORTIFIED roof`} aria-describedby="reveal-help"
      onKeyDown={key} onPointerDown={event=>{if(event.button!==0)return;event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);move(event)}}
      onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))move(event)}}
      onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}}>
      <div className="reveal-scene"><House fortified stories={stories} material={material} storm={storm} damageLevel={upgradedDamage}/></div>
      <div className="reveal-scene reveal-current" style={{clipPath:`inset(0 ${100-position}% 0 0)`}}><House stories={stories} material={material} storm={storm} damageLevel={currentDamage}/></div>
      <div className="reveal-divider" style={{left:`${position}%`}} aria-hidden="true"><span>‹ ›</span></div>
    </div>
    <p id="reveal-help" className="interaction-help">Drag to compare the same storm. Or focus the illustration and use the arrow keys.</p>
  </div>
}
