import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
type Row={player_id:string;levels_cleared:number;score:number;status:string};
export function RaceOutcome({lobbyId,playerId}:{lobbyId:string;playerId:string}){
 const [rows,setRows]=useState<Row[]>([]);
 useEffect(()=>{let live=true;const poll=async()=>{const {data}=await supabase.rpc('mai_run_match_results',{p_lobby:lobbyId});if(live&&Array.isArray(data))setRows(data as Row[])};void poll();const timer=setInterval(()=>void poll(),2500);return()=>{live=false;clearInterval(timer)}},[lobbyId]);
 const me=rows.find(r=>r.player_id===playerId),rival=rows.find(r=>r.player_id!==playerId);
 const bothDone=me?.status==='finished'&&rival?.status==='finished';
 const comparison=(Number(me?.levels_cleared||0)-Number(rival?.levels_cleared||0))||((me?.score||0)-(rival?.score||0));
 return <div className="mx-auto mt-5 max-w-2xl rounded-xl border border-cyan-700 bg-cyan-950/40 p-5 text-center text-white">
 <h3 className="text-xl font-bold">1v1 Match Result</h3>
 <div className="mt-3 flex justify-around"><div>You<br/><b>{me?.levels_cleared??0} levels</b><p>{me?.score??0} pts</p></div><div>Opponent<br/><b>{rival?.levels_cleared??0} levels</b><p>{rival?.score??0} pts</p></div></div>
 <p className="mt-4 font-bold text-amber-300">{!bothDone?'Waiting for both players to finish…':comparison>0?'You won the race!':comparison<0?'Your opponent won the race!':'It’s a tie!'}</p>
 <p className="mt-2 text-xs text-stone-400">Provisional client-reported race scores. No coin prize is awarded automatically.</p></div>;
}
