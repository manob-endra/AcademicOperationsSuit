# Authentication System Documentation

## Overview
Complete role-based authentication system with email verification and Google OAuth.

## Architecture

### Users Roles
- **Super Admin**: Full system control
- **Admin**: Can manage users and content
- **Teacher**: Can create/grade assignments (@cse.du.ac.bd, @du.ac.bd)
- **Student**: Can submit work (@cs.du.ac.bd)

### Email Domain Mapping
- `@cs.du.ac.bd` → Student role
- `@cse.du.ac.bd` → Teacher role
- `@du.ac.bd` → Teacher role

### Database Schema
[Your schema details here]

### Services
- **authService**: Handles signup, login, Google OAuth
- **emailService**: Handles magic link generation and verification
- **roleService**: Manages role-based access

## Setup Guide
[Your setup steps]

## Future Enhancements
- OTP via SMS
- Two-factor authentication
- Password reset functionality
- Admin dashboard