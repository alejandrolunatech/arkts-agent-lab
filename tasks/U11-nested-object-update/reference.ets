@Observed
class Person {
  name: string;
  score: number;

  constructor(name: string, score: number) {
    this.name = name;
    this.score = score;
  }
}

@Component
struct PersonRow {
  @ObjectLink person: Person;

  build() {
    Row({ space: 12 }) {
      Text(`${this.person.name}: ${this.person.score}`)
        .fontSize(18)
        .layoutWeight(1)
      Button('+1')
        .onClick(() => {
          this.person.score += 1;
        })
    }
    .width('100%')
    .padding(12)
  }
}

@Entry
@Component
struct PeoplePage {
  @State people: Person[] = [new Person('Ana', 3), new Person('Bruno', 5), new Person('Carla', 1)];

  build() {
    List({ space: 8 }) {
      ForEach(this.people, (person: Person) => {
        ListItem() {
          PersonRow({ person: person })
        }
      }, (person: Person) => person.name)
    }
    .width('100%')
    .height('100%')
  }
}
