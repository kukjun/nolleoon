export type TravelRoute={page:'home'}|{page:'invite';token:string}|{page:'room';roomId:string}|{page:'invalid'};
export function travelRoute(path:string):TravelRoute{
 if(path==='/travel'||path==='/travel/')return {page:'home'};
 const invite=path.match(/^\/travel\/invite\/([A-Za-z0-9_-]+)$/);if(invite)return {page:'invite',token:invite[1]};
 const room=path.match(/^\/travel\/rooms\/([A-Za-z0-9_-]+)$/);if(room)return {page:'room',roomId:room[1]};
 return {page:'invalid'};
}
