"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Coffee, CupSoda, Hamburger, PackagePlus, Sandwich, ShoppingCart, Trash2 } from "lucide-react";
import { completeSale, type SaleState } from "@/app/(app)/pos/actions";
import { formatMoney } from "@/lib/format";
import { calculateOrderTotal, calculateTableCharge, type BillingPrecision } from "@/lib/business";
import { SessionTimer } from "@/components/session-timer";
import type { Product, TableSession } from "@/types/domain";

type Cart = Record<string,number>;
function ProductIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("tea") || lower.includes("coffee")) return <Coffee size={27}/>;
  if (lower.includes("drink") || lower.includes("water")) return <CupSoda size={27}/>;
  if (lower.includes("burger") || lower.includes("fries")) return <Hamburger size={27}/>;
  if (lower.includes("sandwich")) return <Sandwich size={27}/>;
  return <PackagePlus size={27}/>;
}

export function PosPanel({ products, session, currency, role, taxRate = 0, billingPrecision = 1, fullPage = false }: { products: Product[]; session?: TableSession | null; currency: string; role: string; taxRate?: number; billingPrecision?: BillingPrecision; fullPage?: boolean }) {
  const [cart,setCart] = useState<Cart>({});
  const [category,setCategory] = useState("All");
  const [discount,setDiscount] = useState(0);
  const [paymentMethod,setPaymentMethod] = useState<"cash"|"card"|"bank"|"mobile_wallet"|"other"|"split">("cash");
  const [splitCash,setSplitCash] = useState(0);
  const [now,setNow] = useState<Date | null>(null);
  const [state,action,pending] = useActionState<SaleState,FormData>(completeSale,{});
  useEffect(() => { const first=setTimeout(()=>setNow(new Date()),0); const id=setInterval(()=>setNow(new Date()),10000); return ()=>{clearTimeout(first);clearInterval(id)}; },[]);
  const categories = useMemo(()=>["All",...Array.from(new Set(products.map((p)=>p.product_categories?.name).filter(Boolean) as string[]))],[products]);
  const visible = category === "All" ? products : products.filter((p)=>p.product_categories?.name===category);
  const items = Object.entries(cart).flatMap(([id,quantity])=>{ const product=products.find((p)=>p.id===id); return product ? [{product,quantity}] : []; });
  const productSubtotal = items.reduce((sum,item)=>sum+item.product.price*item.quantity,0);
  const tableCharge = session && now ? calculateTableCharge(new Date(session.start_time),now,session.hourly_rate,session.total_paused_seconds,billingPrecision) : session?.table_charge ?? 0;
  const tax = Math.round(Math.max(0,productSubtotal+tableCharge-discount)*taxRate)/100;
  const total = calculateOrderTotal(productSubtotal,tableCharge,discount,tax);
  const update = (id:string,change:number) => setCart((current)=>{ const next=Math.max(0,(current[id]??0)+change); if (!next) { const copy={...current}; delete copy[id]; return copy; } return {...current,[id]:next}; });
  const payload = JSON.stringify({ tableId: session?.table_id ?? null, sessionId: session?.id ?? null, items: items.map(({product,quantity})=>({product_id:product.id,quantity})), discount, paymentMethod, splitCash });
  return <section className={`panel pos-panel ${fullPage?"pos-full":""}`}>
    <div className="panel-head"><h2 className="panel-title">Point of Sale</h2><span className="badge green" style={{marginLeft:"auto"}}>Live</span></div>
    <div className="pos-body">
      <div className="pos-session"><div><h3>{session?.snooker_tables?.name ?? "Counter sale"}</h3>{session && <div style={{fontSize:11,color:"#66757b",marginTop:3}}>{formatMoney(session.hourly_rate,currency)} / hour</div>}</div>{session && <><span className="badge red">In Use</span><span className="timer"><SessionTimer startedAt={session.start_time} pausedSeconds={session.total_paused_seconds}/></span></>}</div>
      <div className="segmented" style={{width:"100%"}}>{categories.map((name)=><button key={name} className={`segment ${category===name?"active":""}`} onClick={()=>setCategory(name)} style={{flex:1}}>{name}</button>)}</div>
      <div className="product-grid">{visible.map((product)=><button type="button" className="product-card" key={product.id} onClick={()=>update(product.id,1)} disabled={product.track_inventory && product.stock_quantity<=0}><span className="product-icon"><ProductIcon name={product.name}/></span><span className="product-name">{product.name}</span><span className="product-price">{formatMoney(product.price,currency)}</span></button>)}</div>
      <div className="cart">
        {items.length === 0 && !session && <div style={{padding:"20px 0",textAlign:"center",fontSize:12,color:"#718087"}}><ShoppingCart size={25} style={{margin:"0 auto 6px"}}/>Add products to begin</div>}
        {items.map(({product,quantity})=><div className="cart-row" key={product.id}><span className="cart-name">{product.name}</span><span className="qty"><button type="button" onClick={()=>update(product.id,-1)} aria-label={`Decrease ${product.name}`}>−</button><span>{quantity}</span><button type="button" onClick={()=>update(product.id,1)} aria-label={`Increase ${product.name}`}>+</button></span><span className="cart-price">{formatMoney(product.price*quantity,currency)}</span><button type="button" onClick={()=>setCart((c)=>{const n={...c};delete n[product.id];return n})} aria-label={`Remove ${product.name}`} style={{border:0,background:"transparent",color:"#f02e3e",padding:2}}><Trash2 size={15}/></button></div>)}
      </div>
      <div className="totals">
        {session && <div className="total-line"><span>Table charge</span><strong>{formatMoney(tableCharge,currency)}</strong></div>}
        <div className="total-line"><span>Subtotal</span><strong>{formatMoney(productSubtotal+tableCharge,currency)}</strong></div>
        <div className="total-line"><label htmlFor="discount">Discount</label><input id="discount" className="discount-input" type="number" min="0" max={productSubtotal+tableCharge} value={discount} onChange={(e)=>setDiscount(Math.max(0,Number(e.target.value)))} disabled={role==="staff"}/></div>
        {taxRate>0&&<div className="total-line"><span>Tax ({taxRate}%)</span><strong>{formatMoney(tax,currency)}</strong></div>}
        <div className="total-line grand"><span>Total</span><span>{formatMoney(total,currency)}</span></div>
      </div>
      <div className="payment-grid">{(["cash","card","other","split"] as const).map((method)=><button type="button" className={`btn ${paymentMethod===method?"active":""}`} key={method} onClick={()=>setPaymentMethod(method)}>{method[0].toUpperCase()+method.slice(1)}</button>)}</div>
      {paymentMethod==="split"&&<div className="form-grid" style={{margin:"7px 0"}}><div className="field-group"><label style={{color:"#37444a"}}>Cash amount</label><input className="discount-input" style={{width:"100%"}} type="number" min="0" max={total} value={splitCash} onChange={e=>setSplitCash(Math.min(total,Math.max(0,Number(e.target.value))))}/></div><div className="field-group"><label style={{color:"#37444a"}}>Card remainder</label><div style={{fontWeight:800,paddingTop:6}}>{formatMoney(Math.max(0,total-splitCash),currency)}</div></div></div>}
      {state.error && <div className="error-banner" role="alert">{state.error}</div>}
      {state.success && <div className="success-banner" role="status">{state.success} {state.orderId && <Link href={`/orders/${state.orderId}/receipt`} style={{textDecoration:"underline"}}>View receipt {state.orderNumber}</Link>}</div>}
      <form action={action}><input type="hidden" name="payload" value={payload}/><button className="btn btn-primary btn-block" disabled={pending || total<=0 || Boolean(state.success)}>{pending?"Completing…":"Complete order"}</button></form>
    </div>
  </section>;
}
