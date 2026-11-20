// Probe B for docs/JUDGE-GAPS.md of arkts-agent-lab: ArkUI spellings the lab's checker accepts.
// Build this page once in DevEco Studio. Every line marked Q<n> is a question:
// does the build accept it? The checker says yes to all of them.

@Observed
class Item {
  label: string = '';
}

@Builder
function LabelRow(text: string) {
  Row() {
    Text(text)
  }
}

@Component
struct ChildRow {
  @ObjectLink item: Item; // Q1 no initializer: the parent gives it
  @Prop count: number; // Q2 no initializer
  @Link total: number; // Q3 no initializer
  @Consume shared: number; // Q4 no initializer
  @BuilderParam content: () => void; // Q5 no initializer

  build() {
    Column() {
      Text(this.item.label)
      Text(`${this.count} ${this.total} ${this.shared}`)
      this.content()
    }
  }
}

@Component
struct Stars {
  @Link rating: number;

  build() {
    Text(`${this.rating}`)
  }
}

@Entry
@Component
struct Index {
  @State name: string = '';
  @State isOn: boolean = false;
  @State rating: number = 3;
  @State item: Item = new Item();
  @Provide shared: number = 1;

  @Builder
  extra() {
    Text('extra')
  }

  build() {
    Column() {
      TextInput({ text: $$this.name }) // Q6 two-way binding with $$
      Toggle({ type: ToggleType.Switch, isOn: $$this.isOn }) // Q7 two-way binding with $$
      Stars({ rating: $rating }) // Q8 a @Link passed with $
      LabelRow('a') // Q9 a call to a top-level @Builder function
      ChildRow({ item: this.item, count: 1, total: this.rating, content: this.extra })
    }
  }
}
