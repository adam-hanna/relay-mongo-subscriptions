import {
  throttle,
} from "lodash"
import {
  EventEmitter,
  once,
} from 'events';

export type Buff = Array<any>
const key = "data"

class Throttle {
  constructor({ 
    delay, 
    leading, 
    trailing 
  }: { 
    delay: number; 
    leading: boolean; 
    trailing: boolean 
  }) {
    this.err_ = undefined;
    this.buff_ = [];
    this.ee_ = new EventEmitter()
    this.throttledEe_ = throttle(
      () => {
        this.ee_.emit(key)
      }, 
      delay, 
      { 
        trailing,
        leading,
      }
    )
  }

  error(e: Error): void {
    this.err_ = e
    this.throttledEe_()
  }

  buff(): [Buff, Error | undefined] {
    let tmpErr: Error | undefined = undefined
    if (this.err_) {
      tmpErr = new Error(this.err_.message)
      this.err_ = undefined
    }

    const b = [...this.buff_]
    this.buff_.length = 0

    return [b, tmpErr]
  }

  push(doc: any): void {
    this.buff_.push(doc)
    this.throttledEe_()
  }

  async once(): Promise<any[]> {
    return once(this.ee_, key)
  }

  private buff_: Buff;
  private ee_: EventEmitter;
  private throttledEe_: () => void;
  private err_: Error | undefined;
}

export default Throttle;
