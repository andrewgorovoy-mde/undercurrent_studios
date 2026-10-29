export const money=(n:number)=>!Number.isFinite(n)?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export const percent=(n:number)=>!Number.isFinite(n)?'—':`${(n*100).toFixed(1)}%`;
