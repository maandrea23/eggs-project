package com.briannaeggs.interfaces.rest;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class ApiExceptionHandler { @ExceptionHandler(IllegalArgumentException.class) @ResponseStatus(HttpStatus.BAD_REQUEST) Map<String,String> invalid(IllegalArgumentException error){return Map.of("error",error.getMessage());} @ExceptionHandler(AccessDeniedException.class) @ResponseStatus(HttpStatus.FORBIDDEN) Map<String,String> denied(AccessDeniedException error){return Map.of("error",error.getMessage());} }
