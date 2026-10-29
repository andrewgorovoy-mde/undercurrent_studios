import {useEffect,useState} from 'react';
import {validateHistoryDataset,type HistoryDataset} from '../models/history';
export function useHailHistory(){
 const [state,setState]=useState<{data:HistoryDataset|null;loading:boolean;error:string|null}>({data:null,loading:true,error:null});
 useEffect(()=>{const controller=new AbortController();fetch(`${import.meta.env.BASE_URL}data/hail-history.json`,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('Historical data file could not be loaded.');return response.json()}).then(value=>setState({data:validateHistoryDataset(value),loading:false,error:null})).catch(error=>{if(!controller.signal.aborted)setState({data:null,loading:false,error:error instanceof Error?error.message:'Historical data unavailable.'})});return()=>controller.abort()},[]);
 return state;
}
