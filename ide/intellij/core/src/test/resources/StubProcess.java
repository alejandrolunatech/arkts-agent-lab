// A stand-in for the checker in ProcessRunnerTest. Started as `java StubProcess.java <mode>`.
public class StubProcess {
    public static void main(String[] args) throws Exception {
        switch (args[0]) {
            // Copies standard input to standard output and exits with 1, like a check that found errors.
            case "echo" -> {
                System.in.transferTo(System.out);
                System.out.flush();
                System.exit(1);
            }
            // Never reads its input, complains on standard error and exits with 2, like a usage problem.
            case "usage" -> {
                System.err.println("stub: bad usage");
                System.exit(2);
            }
            // Writes more than a pipe holds to both streams before it reads anything.
            case "flood" -> {
                String line = "x".repeat(1023) + "\n";
                for (int i = 0; i < 512; i++) {
                    System.out.print(line);
                    System.err.print(line);
                }
                System.out.flush();
                System.err.flush();
                System.in.readAllBytes();
            }
            // Never ends by itself.
            case "hang" -> Thread.sleep(600_000);
            default -> throw new IllegalArgumentException(args[0]);
        }
    }
}
