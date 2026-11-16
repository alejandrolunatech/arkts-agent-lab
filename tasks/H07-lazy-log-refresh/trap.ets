type Level = 'info' | 'warning' | 'error';

class LogEntry {
  id: number = 0;
  message: string = '';
  level: Level = 'info';
}

const LEVEL_COLORS = {
  info: '#757575',
  warning: '#F57C00',
  error: '#D32F2F',
};

const levelOf = (id: number): Level => (id % 50 === 0 ? 'error' : id % 10 === 0 ? 'warning' : 'info');

const makeEntry = (id: number): LogEntry => ({ id, message: `Event ${id}`, level: levelOf(id) });

const firstEntries = (count: number): LogEntry[] => Array.from({ length: count }, (_, i) => makeEntry(count - i));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Component
struct LogRow {
  @Prop entry: LogEntry;

  build() {
    Row({ space: 12 }) {
      Text(this.entry.message)
        .fontSize(16)
        .layoutWeight(1)
      Text(this.entry.level)
        .fontSize(14)
        .fontColor(LEVEL_COLORS[this.entry.level])
    }
    .width('100%')
    .padding(12)
  }
}

@Entry
@Component
struct LogPage {
  @State entries: LogEntry[] = firstEntries(3000);
  @State refreshing: boolean = false;

  async loadNewer(): Promise<void> {
    this.refreshing = true;
    await wait(1000);
    const highest = this.entries[0].id;
    const newer = [5, 4, 3, 2, 1].map((n) => makeEntry(highest + n));
    this.entries = [...newer, ...this.entries];
    this.refreshing = false;
  }

  build() {
    Column({ space: 8 }) {
      Text(`${this.entries.length} entries`)
        .fontSize(20)
      Refresh({ refreshing: this.refreshing }) {
        List() {
          LazyForEach(this.entries, (entry: LogEntry) => {
            ListItem() {
              LogRow({ entry: entry })
            }
          }, (entry: LogEntry) => `${entry.id}`)
        }
        .width('100%')
        .height('100%')
      }
      .onRefresh(() => this.loadNewer())
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
