export interface RandomGenerator {
  next(): number;
  nextInt(min: number, max: number): number;
  nextNormal(mean?: number, standardDeviation?: number): number;
  getState(): number;
}

/** 可序列化的 Mulberry32，任何运行环境都产生相同序列。 */
export class Mulberry32 implements RandomGenerator {
  private state: number;

  constructor(seedOrState: number) {
    if (!Number.isFinite(seedOrState)) {
      throw new Error("随机种子必须是有限数值");
    }
    this.state = seedOrState >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  nextInt(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new Error("整数随机范围无效");
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  nextNormal(mean = 0, standardDeviation = 1): number {
    if (standardDeviation < 0 || !Number.isFinite(standardDeviation)) {
      throw new Error("标准差必须是非负有限数值");
    }
    const first = Math.max(this.next(), Number.EPSILON);
    const second = this.next();
    const standardNormal =
      Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
    return mean + standardNormal * standardDeviation;
  }

  getState(): number {
    return this.state;
  }
}
