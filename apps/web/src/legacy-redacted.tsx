import type {RedactedGame} from '@trip-court/contracts';
import {TravelRedacted} from './travel-redacted';
export function LegacyRedacted({game}:{game:RedactedGame}){return <TravelRedacted game={game}/>;}
