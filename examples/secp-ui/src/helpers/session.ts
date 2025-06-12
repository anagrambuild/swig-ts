const key = 'swig-id';

export class SwigIdStore {
  static resetId() {
    let id = randomBytes(32);

    let newId = JSON.stringify(Array.from(id));

    sessionStorage.setItem(key, newId);
  }

  static getId() {
    let idString: string | null = null;
    while (!idString) {
      idString = sessionStorage.getItem(key);
      !idString && this.resetId();
    }
    return Uint8Array.from(JSON.parse(idString));
  }

  static getOrCreate() {}
}

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}
