---
description: 'Guidelines for building Spring Boot base applications'
applyTo: '**/*.java, **/*.kt'
---

# Spring Boot Development

## General Spring Boot Instructions

- Make only high confidence suggestions when reviewing code changes.
- Write code with good maintainability practices, including comments on why certain design decisions were made.
- Handle edge cases and write clear exception handling.
- For libraries or external dependencies, mention their usage and purpose in comments.

### Dependency Injection

- Use constructor injection for all required dependencies.
- Declare dependency fields as `private final`.

### Configuration

- Use YAML files (`application.yml`) for externalized configuration.
- Environment Profiles: Use Spring profiles for different environments (dev, test, prod)
- Configuration Properties: Use @ConfigurationProperties for type-safe configuration binding
- Secrets Management: Externalize secrets using environment variables or secret management systems

### Code Organization

- Package Structure: Organize by feature/domain rather than by layer
- Separation of Concerns: Keep controllers thin, services focused, and repositories simple
- Utility Classes: Make utility classes final with private constructors

## Spring Boot Project Structure

- Use Java Spring Boot 3 (Maven, Java 21, Spring Web, Spring Data JPA, Lombok).
- RestControllers handle all request/response logic.
- ServiceImpl classes handle all database operation logic using Repository methods.
- RestControllers must not autowire Repositories directly unless absolutely necessary.
- ServiceImpl classes must not query the database directly (use Repositories).
- Use DTOs for data transfer between RestControllers and ServiceImpl classes.
- Entity classes are only for carrying data from database queries.
-

### RestController Conventions

- Annotate with @RestController and specify class-level @RequestMapping.
- Use best-practice HTTP method annotations (e.g., @PostMapping, @GetMapping).
- Autowire dependencies in class methods without constructors unless specified.
- Methods return ResponseEntity<ApiResponse>.
- Implement all logic in try-catch blocks; handle errors with GlobalExceptionHandler.

### ApiResponse & GlobalExceptionHandler

- ApiResponse and GlobalExceptionHandler classes must be present and follow best practices for structure and error handling.

### Service Layer

- Place business logic in `@Service`-annotated classes.
- Services should be stateless and testable.
- Inject repositories via the constructor.
- Service method signatures should use domain IDs or DTOs, not expose repository entities directly unless necessary.
- Service classes are interfaces; implementations are ServiceImpl classes annotated with @Service.
- Use Lombok's `@RequiredArgsConstructor` for constructor-based dependency injection in ServiceImpl classes. Declare all dependencies as `private final` fields.
- ServiceImpl methods return DTOs (not entities) unless necessary.
- Use repository methods with .orElseThrow for existence checks.
- Use @Transactional or transactionTemplate for multiple sequential DB operations.

### Repository Class Conventions

- Annotate with @Repository.
- Use interfaces extending JpaRepository<Entity, ID>.
- Use JPQL for @Query methods.
- Use @EntityGraph(attributePaths={...}) to avoid N+1 problems in relationship queries.
- Use DTOs for multi-join queries with @Query.

### Entity Class Conventions

- Annotate with @Entity and @Data (Lombok).
- Use @Id and @GeneratedValue(strategy=GenerationType.IDENTITY) for IDs.
- Use FetchType.LAZY for relationships.
- Annotate properties with validation annotations (e.g., @Size, @NotEmpty, @Email).

### DTO Conventions

- Use Java records for DTOs unless otherwise specified.
- Include a compact canonical constructor for parameter validation (not null, blank, etc.).

### Entity-DTO Mapping

- Use MapStruct for mapping between JPA entities and domain/API models.
- Create dedicated mapper interfaces annotated with `@Mapper(componentModel = "spring")` to enable Spring dependency injection.
- MapStruct mappers should be injected into services via constructor injection.
- Example: `@Mapper(componentModel = "spring") public interface UserMapper { UserDto toDto(User entity); User toEntity(UserDto dto); }`
- Avoid manual mapping code in services; delegate all mapping logic to MapStruct mappers.

### Logging

- Use SLF4J for all logging (`private static final Logger logger = LoggerFactory.getLogger(MyClass.class);`).
- Do not use concrete implementations (Logback, Log4j2) or `System.out.println()` directly.
- Use parameterized logging: `logger.info("User {} logged in", userId);`.

### Security & Input Handling

- Use parameterized queries | Always use Spring Data JPA or `NamedParameterJdbcTemplate` to prevent SQL injection.
- Validate request bodies and parameters using JSR-380 (`@NotNull`, `@Size`, etc.) annotations and `BindingResult`

## Build and Verification

- After adding or modifying code, verify the project continues to build successfully.
- If the project uses Maven, run `mvn clean package`.
- If the project uses Gradle, run `./gradlew build` (or `gradlew.bat build` on Windows).
- Ensure all tests pass as part of the build.

## Useful Commands

| Gradle Command             | Maven Command                    | Description                                   |
|:---------------------------|:---------------------------------|:----------------------------------------------|
| `./gradlew bootRun`        | `./mvnw spring-boot:run`         | Run the application.                          |
| `./gradlew build`          | `./mvnw package`                 | Build the application.                        |
| `./gradlew test`           | `./mvnw test`                    | Run tests.                                    |
| `./gradlew bootJar`        | `./mvnw spring-boot:repackage`   | Package the application as a JAR.             |
| `./gradlew bootBuildImage` | `./mvnw spring-boot:build-image` | Package the application as a container image. |