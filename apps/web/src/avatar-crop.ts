export function cropSquare(width:number,height:number,zoom:number,x=0.5,y=0.5){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>4000000)throw new Error('사진은 400만 화소 이하로 골라 주세요.');
 if(!Number.isFinite(zoom)||zoom<1||zoom>3||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)throw new Error('사진 영역을 다시 선택해 주세요.');
 const size=Math.min(width,height)/zoom;return {sx:(width-size)*x,sy:(height-size)*y,size};
}
export async function cropAvatar(file:File,zoom:number,x:number,y:number):Promise<File>{
 const bitmap=await createImageBitmap(file);
 try{const crop=cropSquare(bitmap.width,bitmap.height,zoom,x,y);const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const context=canvas.getContext('2d');if(!context)throw new Error('사진 편집을 시작하지 못했어요.');context.drawImage(bitmap,crop.sx,crop.sy,crop.size,crop.size,0,0,256,256);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('사진을 변환하지 못했어요.')),'image/webp',0.85));return new File([blob],'avatar.webp',{type:blob.type});}finally{bitmap.close();}
}
