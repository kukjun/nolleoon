export class SnapshotOrder {
 private sequence=0;
 private version:number;
 constructor(version:number){this.version=version;}
 begin(){return ++this.sequence;}
 current(sequence:number){return sequence===this.sequence;}
 accept(sequence:number,version:number){if(!this.current(sequence)||version<this.version)return false;this.version=version;return true;}
}
