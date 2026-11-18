import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import './styles.css';
export function Button({children,onPress,loading=false,variant='primary',disabled,type='button',...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'onClick'> & {onPress?:()=>void|Promise<void>;loading?:boolean;variant?:'primary'|'secondary'|'quiet'}) {
  const [pending,setPending]=useState(false);const [failed,setFailed]=useState(false);const errorId=useId();const busy=useRef(false);
  async function press() {
    if(busy.current || loading || disabled || !onPress)return;
    busy.current=true;setPending(true);setFailed(false);
    try{await onPress();}catch{setFailed(true);}finally{busy.current=false;setPending(false);}
  }
  return <><button {...props} type={type} aria-describedby={failed?errorId:undefined} className={`button button--${variant}`} disabled={disabled||loading||pending} aria-busy={loading||pending} onClick={()=>void press()}>{loading||pending?<><span className="spinner" aria-hidden="true"/>처리 중…</>:children}</button>{failed&&<p id={errorId} className="field-error" role="alert">동작을 완료하지 못했어요. 다시 시도해 주세요.</p>}</>;
}
export function Input({label,error,hint,id,...props}:InputHTMLAttributes<HTMLInputElement> & {label:string;error?:string;hint?:string}) {
  const generated=useId();const inputId=id??generated;const detail=`${inputId}-detail`;
  return <div className="field"><label htmlFor={inputId}>{label}{props.required && <span className="required">필수</span>}</label><input {...props} id={inputId} aria-invalid={Boolean(error)} aria-describedby={error||hint?detail:undefined}/>{(error||hint)&&<p id={detail} className={error?'field-error':'field-hint'} role={error?'alert':undefined}>{error||hint}</p>}</div>;
}
export function ChoiceGroup({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:{value:string;label:string;hint?:string}[]}) {
  const name=useId();return <fieldset className="choices"><legend>{label}</legend>{options.map(option=><label className={`choice ${option.value===value?'choice--selected':''}`} key={option.value}><input type="radio" name={name} value={option.value} checked={option.value===value} onChange={()=>onChange(option.value)}/><span><strong>{option.label}</strong>{option.hint&&<small>{option.hint}</small>}</span>{option.value===value&&<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 10 4 4 8-8"/></svg>}</label>)}</fieldset>;
}
export function Status({children,tone='neutral',live=false}:{children:ReactNode;tone?:'neutral'|'success'|'warning';live?:boolean}) {
  return <p className={`status status--${tone}`} role={live?'status':undefined}><span className="status-mark" aria-hidden="true"/>{children}</p>;
}
export function Banner({title,children,tone='info'}:{title:string;children:ReactNode;tone?:'info'|'warning'}) {
  return <aside className={`banner banner--${tone}`} aria-label={title}><strong>{title}</strong><div>{children}</div></aside>;
}
export function Timer({seconds,label='남은 시간 · 표시 예시'}:{seconds:number;label?:string}) {
  const safe=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;
  return <div className="timer"><span>{label}</span><output role="timer" aria-live="off" aria-label={`${label}: ${Math.floor(safe/60)}분 ${safe%60}초`}>{String(Math.floor(safe/60)).padStart(2,'0')}:{String(safe%60).padStart(2,'0')}</output></div>;
}
export function Modal({open,title,onDismiss,children}:{open:boolean;title:string;onDismiss:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement;const node=dialog.current!;node.showModal();
    node.querySelector<HTMLButtonElement>('button')?.focus();
    return()=>{node.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
  },[open]);
  return <dialog className="modal" ref={dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onDismiss();}} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const nodes=[...dialog.current!.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex],[contenteditable="true"]')].filter(node=>
      !node.matches(':disabled') && !node.closest('[hidden],[inert],[aria-hidden="true"]') && node.getClientRects().length>0 && getComputedStyle(node).visibility!=='hidden' && (node.tabIndex>=0 || (node.isContentEditable && !node.hasAttribute('tabindex')))
    );
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}><header><h2 id={titleId}>{title}</h2><Button variant="quiet" aria-label="닫기" onPress={onDismiss}>닫기</Button></header>{children}</dialog>;
}
export function Layout({children,demo=false}:{children:ReactNode;demo?:boolean}) {
  return <div className="app-layout"><header className="site-header"><a className="wordmark" href="/" aria-label="놀러온 홈"><h1>놀러온</h1></a><a className="header-link" href={demo?'/':'/?view=design'}>{demo?'홈으로':'UI 미리보기'}<span aria-hidden="true">↗</span></a></header><main>{children}</main><footer className="site-footer">우리끼리 가볍게, 서로에게 다정하게.</footer></div>;
}
