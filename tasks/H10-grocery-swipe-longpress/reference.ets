@Observed
class GroceryItem {
  id: number;
  name: string;
  bought: boolean = false;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}

@Component
struct GroceryRow {
  @ObjectLink item: GroceryItem;
  onToggled: () => void = () => {};

  build() {
    Row() {
      Text(this.item.name)
        .fontSize(18)
        .fontColor(this.item.bought ? '#9E9E9E' : '#000000')
        .decoration({
          type: this.item.bought ? TextDecorationType.LineThrough : TextDecorationType.None
        })
    }
    .width('100%')
    .padding(16)
    .gesture(
      LongPressGesture({ duration: 500 })
        .onAction(() => {
          this.item.bought = !this.item.bought;
          this.onToggled();
        })
    )
  }
}

@Entry
@Component
struct GroceryPage {
  @State items: GroceryItem[] = [
    new GroceryItem(1, 'Milk'),
    new GroceryItem(2, 'Bread'),
    new GroceryItem(3, 'Eggs'),
    new GroceryItem(4, 'Apples'),
  ];
  @State boughtCount: number = 0;
  @State draft: string = '';
  private nextId: number = 5;

  countBought(): void {
    let count = 0;
    for (const item of this.items) {
      if (item.bought) {
        count += 1;
      }
    }
    this.boughtCount = count;
  }

  removeItem(id: number): void {
    const position = this.items.findIndex((item: GroceryItem) => item.id === id);
    if (position >= 0) {
      this.items.splice(position, 1);
      this.countBought();
    }
  }

  addItem(): void {
    const name = this.draft.trim();
    if (name.length === 0) {
      return;
    }
    this.items.push(new GroceryItem(this.nextId, name));
    this.nextId += 1;
    this.draft = '';
  }

  @Builder
  deleteAction(id: number) {
    Button('Delete')
      .backgroundColor('#D32F2F')
      .onClick(() => {
        this.removeItem(id);
      })
  }

  build() {
    Column({ space: 12 }) {
      Text(`${this.items.length} items, ${this.boughtCount} bought`)
        .fontSize(20)
      List({ space: 4 }) {
        ForEach(this.items, (item: GroceryItem) => {
          ListItem() {
            GroceryRow({
              item: item,
              onToggled: () => {
                this.countBought();
              }
            })
          }
          .swipeAction({
            end: {
              builder: () => {
                this.deleteAction(item.id)
              }
            }
          })
        }, (item: GroceryItem) => `${item.id}`)
      }
      .width('100%')
      .layoutWeight(1)

      Row({ space: 8 }) {
        TextInput({ placeholder: 'New item', text: this.draft })
          .layoutWeight(1)
          .onChange((value: string) => {
            this.draft = value;
          })
        Button('Add')
          .onClick(() => {
            this.addItem();
          })
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
