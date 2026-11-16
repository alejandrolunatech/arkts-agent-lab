class LogEntry {
  id: number;
  message: string;
  level: string;

  constructor(id: number, message: string, level: string) {
    this.id = id;
    this.message = message;
    this.level = level;
  }
}

function levelOf(id: number): string {
  if (id % 50 === 0) {
    return 'error';
  }
  if (id % 10 === 0) {
    return 'warning';
  }
  return 'info';
}

function colorOf(level: string): string {
  if (level === 'error') {
    return '#D32F2F';
  }
  if (level === 'warning') {
    return '#F57C00';
  }
  return '#757575';
}

function makeEntry(id: number): LogEntry {
  return new LogEntry(id, `Event ${id}`, levelOf(id));
}

class LogSource implements IDataSource {
  private entries: LogEntry[] = [];
  private listeners: DataChangeListener[] = [];

  constructor(count: number) {
    for (let id = count; id >= 1; id--) {
      this.entries.push(makeEntry(id));
    }
  }

  totalCount(): number {
    return this.entries.length;
  }

  getData(index: number): LogEntry {
    return this.entries[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const position = this.listeners.indexOf(listener);
    if (position >= 0) {
      this.listeners.splice(position, 1);
    }
  }

  addNewest(count: number): void {
    for (let i = 0; i < count; i++) {
      this.entries.unshift(makeEntry(this.entries.length + 1));
      for (const listener of this.listeners) {
        listener.onDataAdd(0);
      }
    }
  }
}

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
        .fontColor(colorOf(this.entry.level))
    }
    .width('100%')
    .padding(12)
  }
}

@Entry
@Component
struct LogPage {
  private source: LogSource = new LogSource(3000);
  @State total: number = 3000;
  @State refreshing: boolean = false;

  loadNewer(): void {
    this.refreshing = true;
    setTimeout(() => {
      this.source.addNewest(5);
      this.total = this.source.totalCount();
      this.refreshing = false;
    }, 1000);
  }

  build() {
    Column({ space: 8 }) {
      Text(`${this.total} entries`)
        .fontSize(20)
      Refresh({ refreshing: $$this.refreshing }) {
        List() {
          LazyForEach(this.source, (entry: LogEntry) => {
            ListItem() {
              LogRow({ entry: entry })
            }
          }, (entry: LogEntry) => `${entry.id}`)
        }
        .width('100%')
        .height('100%')
      }
      .onRefreshing(() => {
        this.loadNewer();
      })
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
