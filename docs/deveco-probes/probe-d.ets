// Probe D for docs/JUDGE-GAPS.md of arkts-agent-lab: one question left over from probe C, on its own.
// Build this page once in DevEco Studio. Does the build report an error on the line marked S1?

class Plain {
  label: string = '';
}

@Component
struct PlainRow {
  @ObjectLink item: Plain; // S1 @ObjectLink of a class with no @Observed

  build() {
    Text(this.item.label)
  }
}

@Entry
@Component
struct Index {
  @State plain: Plain = new Plain();

  build() {
    Column() {
      PlainRow({ item: this.plain })
    }
  }
}
