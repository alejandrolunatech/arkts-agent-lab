// Probe C for docs/JUDGE-GAPS.md of arkts-agent-lab: mistakes a DevEco build is believed to reject.
// Build this page once in DevEco Studio. Every line marked R<n> is a question:
// does the build report an error on it?

class Plain {
  label: string = '';
}

@Component
struct GapChild {
  @Link value: number = 0; // R1 a @Link with a default value

  build() {
    Text(`${this.value}`)
  }
}

@CustomDialog
struct NoControllerDialog { // R2 a @CustomDialog with no CustomDialogController field
  build() {
    Text('dialog')
  }
}

@Component
struct Watcher {
  @State @Watch('missing') count: number = 0; // R3 @Watch names a method that does not exist

  build() {
    Text(`${this.count}`)
  }
}

@Component
struct PlainRow {
  @ObjectLink item: Plain; // R4 @ObjectLink of a class with no @Observed

  build() {
    Text(this.item.label)
  }
}

@Entry
@Component
struct Index {
  @State value: number = 1;
  @State active: number = 0;
  @State label: string = 'a';
  @State plain: Plain = new Plain();

  title() {
    return Text(this.label);
  }

  build() {
    Column() {
      GapChild({ value: this.value })
      GapChild() // R5 a child created without its @Link
      this.title() // R6 a plain method that returns a component
      this.active === 0 && Text('Welcome home') // R7
      this.active === 1 ? Text('a') : Text('b') // R8
      console.log('hi') // R9
      let x: number = 1; // R10
      ['a', 'b'].forEach((name: string) => { // R11
        Text(name)
      })
      Watcher()
      PlainRow({ item: this.plain })
    }
  }
}
