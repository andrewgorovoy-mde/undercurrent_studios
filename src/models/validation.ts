export function finite(name:string,value:number,min=0,max=Number.MAX_VALUE){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new RangeError(`${name} must be a finite number ${max===Number.MAX_VALUE?`at least ${min}`:`between ${min} and ${max}`}.`);return value}
export const probability=(name:string,value:number)=>finite(name,value,0,1);
export function integer(name:string,value:number,min=0){finite(name,value,min);if(!Number.isInteger(value))throw new RangeError(`${name} must be an integer.`);return value}
export function oneOf<T extends string>(name:string,value:T,choices:readonly string[]){if(!choices.includes(value))throw new RangeError(`${name} is missing or unsupported.`);return value}
export function booleanValue(name:string,value:boolean){if(typeof value!=='boolean')throw new TypeError(`${name} must be explicitly true or false.`);return value}
