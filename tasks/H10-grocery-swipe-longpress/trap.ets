class GroceryItem {
  id: number = 0;
  name: string = '';
  bought: boolean = false;
}

@Component
struct GroceryRow {
  @Prop item: GroceryItem;
  onToggle: (id: number) => void = () => {};

  build() {
    Row() {
      Text(this.item.name)
        .fontSize(18)
        .fontColor(this.item.bought ? '#9E9E9E' : '#000000')
        .decoration({ type: this.item.bought ? 'line-through' : 'none' })
    }
    .width('100%')
    .padding(16)
    .onLongPress(() => this.onToggle(this.item.id))
  }
}

@Entry
@Component
struct GroceryPage {
  @State items: GroceryItem[] = [
    { id: 1, name: 'Milk', bought: false },
    { id: 2, name: 'Bread', bought: false },
    { id: 3, name: 'Eggs', bought: false },
    { id: 4, name: 'Apples', bought: false },
  ];
  @State draft: string = '';
  private nextId: number = 5;

  toggle(id: number): void {
    this.items = this.items.map((item) => (item.id === id ? { ...item, bought: !item.bought } : item));
  }

  remove(id: number): void {
    this.items = this.items.filter(({ id: itemId }) => itemId !== id);
  }

  add(): void {
    const name = this.draft.trim();
    if (!name) {
      return;
    }
    this.items = [...this.items, { id: this.nextId++, name, bought: false }];
    this.draft = '';
  }

  @Builder
  deleteAction(id: number) {
    Button('Delete')
      .backgroundColor('#D32F2F')
      .onClick(() => this.remove(id))
  }

  build() {
    Column({ space: 12 }) {
      Text(`${this.items.length} items, ${this.items.filter((item) => item.bought).length} bought`)
        .fontSize(20)
      List({ space: 4 }) {
        ForEach(this.items, (item: GroceryItem) => {
          ListItem() {
            GroceryRow({ item: item, onToggle: (id: number) => this.toggle(id) })
          }
          .swipeAction({ end: this.deleteAction(item.id) })
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
          .onClick(() => this.add())
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
