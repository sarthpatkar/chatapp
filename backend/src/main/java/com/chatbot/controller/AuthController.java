package com.chatbot.controller;

import com.chatbot.entity.User;
import com.chatbot.repository.UserRepository;
import com.chatbot.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/auth")
@CrossOrigin("*")
public class AuthController {

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private JwtUtil jwtUtil;

    // REGISTER
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        try {
            if (userRepo.findByEmail(user.getEmail()).isPresent()) {
                return ResponseEntity
                        .badRequest()
                        .body("Email already exists");
            }

            userRepo.save(user);
            return ResponseEntity.ok("User registered successfully");

        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Registration failed");
        }
    }

    // LOGIN
    @PostMapping("/login")
    public Object login(@RequestBody User loginUser) {

        Optional<User> userOpt =
                userRepo.findByEmail(loginUser.getEmail());

        if (userOpt.isEmpty())
            return "User not found";

        User user = userOpt.get();

        if (!user.getPassword().equals(loginUser.getPassword()))
            return "Invalid password";

        String token = jwtUtil.generateToken(user.getId());

        return new AuthResponse(token, user.getId(), user.getName());
    }

    record AuthResponse(String token, Long userId, String name) {}
}