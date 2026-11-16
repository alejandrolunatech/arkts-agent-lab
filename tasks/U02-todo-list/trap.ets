@Entry
@Component
struct TodoPage {
  @State todos: { id: number; title: string }[] = [];
  @State draft: string = '';

  addTodo() {
    const title = this.draft.trim();
    if (!title) {
      return;
    }
    this.todos = [...this.todos, { id: Date.now(), title }];
    this.draft = '';
  }

  removeTodo(id: number) {
    this.todos = this.todos.filter((todo) => todo.id !== id);
  }

  build() {
    Column({ space: 12 }) {
      Row({ space: 8 }) {
        TextInput({ placeholder: 'New todo', text: this.draft })
          .layoutWeight(1)
          .onChange((value) => {
            this.draft = value;
          })
        Button('Add')
          .onClick(() => this.addTodo())
      }

      Column({ space: 8 }) {
        this.todos.map((todo) =>
          Text(todo.title)
            .fontSize(18)
            .width('100%')
            .onClick(() => this.removeTodo(todo.id))
        )
      }
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
