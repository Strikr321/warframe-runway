package dev.sublok.runway;

import org.springframework.boot.SpringApplication;

public class TestRunwayApiApplication {

    public static void main(String[] args) {
        SpringApplication.from(RunwayApiApplication::main)
                .with(TestcontainersConfiguration.class)
                .run(args);
    }
}
