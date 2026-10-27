import { createContext, useContext, useEffect, useState, ReactNode } from "react";
type Line = { id:string; qty:number };
const Ctx = createContext<{lines:Line[]; add:(id:string,q?:number)=>void; setQty:(id:string,q:number)=>void; clear:()=>void; count:number; ready:boolean}>({lines:[],add(){},setQty(){},clear(){},count:0,ready:false});
export const useCart = () => useContext(Ctx);
export default function CartProvider({children}:{children:ReactNode}) {
  const [lines,setLines] = useState<Line[]>([]);
  const [ready,setReady] = useState(false);
  useEffect(()=>{ try{ setLines(JSON.parse(localStorage.getItem("ct-cart")||"[]")); }catch{} setReady(true); },[]);
  useEffect(()=>{ if(!ready) return; try{ localStorage.setItem("ct-cart",JSON.stringify(lines)); }catch{} },[lines,ready]);
  const add=(id:string,q=1)=>setLines(l=>l.some(x=>x.id===id)?l.map(x=>x.id===id?{...x,qty:x.qty+q}:x):[...l,{id,qty:q}]);
  const setQty=(id:string,q:number)=>setLines(l=>q<=0?l.filter(x=>x.id!==id):l.map(x=>x.id===id?{...x,qty:q}:x));
  return <Ctx.Provider value={{lines,add,setQty,clear:()=>setLines([]),count:lines.reduce((s,x)=>s+x.qty,0),ready}}>{children}</Ctx.Provider>;
}
