import { supabase } from '@/lib/supabase';
import type { Difficulty, Gender } from '../game/types';
export interface ActiveRun { runId:string; playerName:string; gender:Gender; difficulty:Difficulty; seed:number; lobbyId?:string; }
export interface LeaderboardEntry { playerName:string; gender:Gender; difficulty:Difficulty; score:number; levelsCleared:number; lettersCollected:number; finishedAt:string; }
export interface FinishRunInput { runId:string; playerId:string; score:number; levelsCleared:number; lettersCollected:number; coins:number; }
export interface Lobby { id:string; host_id:string; guest_id:string|null; difficulty:Difficulty; status:'waiting'|'playing'|'finished'|'cancelled'; seed:number; started_at:string|null; host?:{display_name:string|null}; guest?:{display_name:string|null}; }
export async function getProfile(userId:string) {
 const {data,error}=await supabase.from('user_profiles').select('id, display_name, username, troll_coins').eq('id',userId).single();
 if(error)throw error; return data;
}
export async function openWallet(playerId:string) { const p=await getProfile(playerId);return Number(p.troll_coins ?? 0); }
export async function startRun(playerId:string,_name:string,gender:Gender,difficulty:Difficulty):Promise<string> {
 const {data,error}=await supabase.rpc('mai_run_start_solo',{p_gender:gender,p_difficulty:difficulty}); if(error)throw error;return String(data);
}
export async function finishRun(input:FinishRunInput):Promise<{balance:number}> {
 const {error}=await supabase.rpc('mai_run_finish',{p_run:input.runId,p_score:input.score,p_levels:input.levelsCleared,p_letters:input.lettersCollected,p_collected:input.coins});
 if(error)throw error;
 return {balance:await openWallet(input.playerId)};
}
export async function fetchLeaderboard(limit=20):Promise<LeaderboardEntry[]> {
 const {data,error}=await supabase.rpc('mai_run_leaderboard',{p_limit:limit});if(error)throw error;
 return (data||[]).map((r:any)=>({playerName:String(r.player_name||'Troll'),gender:r.gender,difficulty:r.difficulty,score:Number(r.score),levelsCleared:Number(r.levels_cleared),lettersCollected:Number(r.letters_collected),finishedAt:String(r.finished_at)}));
}
export async function listLobbies():Promise<Lobby[]> { const {data,error}=await supabase.from('mai_run_lobbies').select('*').eq('status','waiting').order('created_at',{ascending:false}).limit(30);if(error)throw error;return data as Lobby[]; }
export async function createLobby(difficulty:Difficulty):Promise<string>{const {data,error}=await supabase.rpc('mai_run_create_lobby',{p_difficulty:difficulty});if(error)throw error;return String(data);}
export async function joinLobby(id:string){const {error}=await supabase.rpc('mai_run_join_lobby',{p_lobby:id});if(error)throw error;}
export async function beginMatch(id:string):Promise<string>{const {data,error}=await supabase.rpc('mai_run_begin_match',{p_lobby:id});if(error)throw error;return String(data);}
export async function getLobby(id:string):Promise<Lobby>{const {data,error}=await supabase.from('mai_run_lobbies').select('*').eq('id',id).single();if(error)throw error;return data as Lobby;}
export async function cancelLobby(id:string){const {error}=await supabase.rpc('mai_run_cancel_lobby',{p_lobby:id});if(error)throw error;}
