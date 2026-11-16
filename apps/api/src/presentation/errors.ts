import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { errorMessages, type ErrorCode, type ErrorResponse } from '@trip-court/contracts';
import { DomainFailure } from '../domain/failure.js';
import { SessionRequired } from '../application/browser-sessions.js';
import { StorageError } from '../application/ports/storage.js';
const statuses:Record<ErrorCode,number>={ROOM_CLOSED:410,SESSION_REQUIRED:401,FORBIDDEN:403,INVALID_INPUT:400,NOT_FOUND:404,STATE_CONFLICT:409,DEADLINE_PASSED:409,TEMPORARILY_UNAVAILABLE:503,INTERNAL_ERROR:500};
export function presentError(error:unknown):{status:number;body:ErrorResponse} {
 let code:ErrorCode='INTERNAL_ERROR';
 if(error instanceof SessionRequired)code='SESSION_REQUIRED';
 else if(error instanceof DomainFailure)code=error.code;
 else if(error instanceof StorageError)code=error.code==='busy'?'TEMPORARILY_UNAVAILABLE':error.code==='constraint'?'STATE_CONFLICT':'INTERNAL_ERROR';
 else if(error instanceof HttpException) {
  const status=error.getStatus();code=status===401?'SESSION_REQUIRED':status===403?'FORBIDDEN':status===404?'NOT_FOUND':status===409?'STATE_CONFLICT':status>=400&&status<500?'INVALID_INPUT':'INTERNAL_ERROR';
 }
 return {status:statuses[code],body:{error:{code,message:errorMessages[code]}}};
}
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
 catch(exception:unknown,host:ArgumentsHost) {
  const response=host.switchToHttp().getResponse<Response>();const error=presentError(exception);
  response.setHeader('Cache-Control','no-store');response.status(error.status).json(error.body);
 }
}
