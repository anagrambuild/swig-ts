type Bit = boolean;

interface Node {
  freq: number;
  ch: number | null;
  left: Node | null;
  right: Node | null;
}

// A basic min-heap priority queue based on frequency
class MinHeap {
  private data: Node[] = [];

  push(node: Node) {
    this.data.push(node);
    this.data.sort((a, b) => a.freq - b.freq); // Keep smallest freq at front
  }

  pop(): Node | undefined {
    return this.data.shift();
  }

  get length(): number {
    return this.data.length;
  }
}

export class HuffmanEncoder {
  private codes: Map<number, Bit[]> = new Map();
  public treeData: number[] = [];

  constructor(text: string) {
    const freq = new Map<number, number>();
    for (const char of text) {
      const byte = char.charCodeAt(0);
      freq.set(byte, (freq.get(byte) || 0) + 1);
    }

    const heap = new MinHeap();
    for (const [ch, frequency] of freq.entries()) {
      heap.push({ freq: frequency, ch, left: null, right: null });
    }

    while (heap.length > 1) {
      const left = heap.pop()!;
      const right = heap.pop()!;
      heap.push({
        freq: left.freq + right.freq,
        ch: null,
        left,
        right,
      });
    }

    const root = heap.pop()!;
    this.buildCodes(root, []);
    this.serializeTree(root, this.treeData);
  }

  private buildCodes(node: Node, code: Bit[]) {
    if (node.ch !== null) {
      this.codes.set(node.ch, code.length === 0 ? [false] : code);
    } else {
      if (node.left) {
        this.buildCodes(node.left, [...code, false]);
      }
      if (node.right) {
        this.buildCodes(node.right, [...code, true]);
      }
    }
  }

  private serializeTree(node: Node, data: number[]): number {
    if (node.ch !== null) {
      // Leaf: type=0, character, unused
      data.push(0, node.ch, 0);
      return data.length / 3 - 1;
    } else {
      const leftIdx = node.left ? this.serializeTree(node.left, data) : 0;
      const rightIdx = node.right ? this.serializeTree(node.right, data) : 0;

      // Internal node: type=1, leftIdx, rightIdx
      data.push(1, leftIdx, rightIdx);
      return data.length / 3 - 1;
    }
  }

  encode(text: string): Uint8Array {
    const bits: Bit[] = [];

    for (const char of text) {
      const byte = char.charCodeAt(0);
      const code = this.codes.get(byte);
      if (code) {
        bits.push(...code);
      }
    }

    // Pack bits into bytes
    const bytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        if (bits[i + j]) {
          byte |= 1 << (7 - j);
        }
      }
      bytes.push(byte);
    }

    return new Uint8Array(bytes);
  }
}
