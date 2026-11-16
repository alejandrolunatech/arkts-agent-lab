interface Todo {
  id: number;
  title: string;
}

@Entry
@Component
struct TodoPage {
  @State todos: Todo[] = [];
  @State draft: string = '';
  private nextId: number = 1;

  private addTodo(): void {
    const title = this.draft.trim();
    if (title.length === 0) {
      return;
    }
    const todo: Todo = { id: this.nextId, title: title };
    this.nextId += 1;
    this.todos.push(todo);
    this.draft = '';
  }

  private removeTodo(id: number): void {
    this.todos = this.todos.filter((todo: Todo) => todo.id !== id);
  }

  build() {
    Column({ space: 12 }) {
      Row({ space: 8 }) {
        TextInput({ placeholder: 'New todo', text: this.draft })
          .layoutWeight(1)
          .onChange((value: string) => {
            this.draft = value;
          })
        Button('Add')
          .onClick(() => {
            this.addTodo();
          })
      }

      List({ space: 8 }) {
        ForEach(this.todos, (todo: Todo) => {
          ListItem() {
            Text(todo.title)
              .fontSize(18)
              .width('100%')
          }
          .onClick(() => {
            this.removeTodo(todo.id);
          })
        }, (todo: Todo) => todo.id.toString())
      }
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
