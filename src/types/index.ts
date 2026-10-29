export type Quality = 'Observed data' | 'Published modeled data' | 'Prototype assumption' | 'Demonstration data';
export interface Home {county:string;zip:string;area:number;stories:string;age:number;material:string;complexity:string;damage:string;condition:string}
export interface Insurance {coverage:string;deductibleType:string;deductible:number;dwelling:number;depreciation:number;premium:number;limitations:string;limit:number}
export interface Scenario {intensity:number;horizon:number}
