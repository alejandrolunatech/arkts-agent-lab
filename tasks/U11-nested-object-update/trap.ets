class Person {
  constructor(public name: string, public score: number) {}
}

@Entry
@Component
struct PeoplePage {
  @State people: Person[] = [
    { name: 'Ana', score: 3 },
    { name: 'Bruno', score: 5 },
    { name: 'Carla', score: 1 },
  ];

  addPoint(index: number): void {
    this.people = this.people.map((person: Person, i: number): Person =>
      i === index ? { ...person, score: person.score + 1 } : person
    );
  }

  build() {
    List({ space: 8 }) {
      ForEach(this.people, (person: Person, index: number) => {
        ListItem() {
          Row({ space: 12 }) {
            Text(`${person.name}: ${person.score}`)
              .fontSize(18)
              .layoutWeight(1)
            Button('+1')
              .onClick(() => {
                this.addPoint(index);
              })
          }
          .width('100%')
          .padding(12)
        }
      }, (person: Person) => person.name)
    }
    .width('100%')
    .height('100%')
  }
}
