#!/bin/bash

# Swig Workshop Startup Script
echo "🎓 Starting Swig Workshop Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check for required tools
if ! command_exists bun; then
    echo -e "${RED}❌ Bun is not installed. Please install Bun first.${NC}"
    exit 1
fi

if ! command_exists solana; then
    echo -e "${RED}❌ Solana CLI is not installed. Please install Solana CLI first.${NC}"
    exit 1
fi

if ! command_exists solana-test-validator; then
    echo -e "${RED}❌ Solana test validator is not available. Please ensure Solana CLI is properly installed.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Check if validator is running
if port_in_use 8899; then
    echo -e "${GREEN}✅ Solana validator detected on port 8899${NC}"
else
    echo -e "${RED}❌ Solana validator not running on port 8899${NC}"
    echo -e "${YELLOW}💡 Please start the validator first:${NC}"
    echo -e "   cd examples/kit/transfer"
    echo -e "   bun start-validator"
    exit 1
fi

# Start backend
echo -e "${BLUE}🔧 Starting backend server...${NC}"
cd "$(dirname "$0")"
cd backend

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
    bun install
fi

# Start backend in background
bun dev &
BACKEND_PID=$!

echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
sleep 5

# Check if backend is responding
# if ! port_in_use 3002; then
#     echo -e "${RED}❌ Failed to start backend server${NC}"
#     exit 1
# fi

echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"

# Start frontend
echo -e "${BLUE}🔧 Starting frontend application...${NC}"
cd "../frontend"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    bun install
fi

# Start frontend in background
bun dev &
FRONTEND_PID=$!

echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
sleep 8

# Check if frontend is responding
# if ! port_in_use 3000; then
#     echo -e "${RED}❌ Failed to start frontend application${NC}"
#     exit 1
# fi

echo -e "${GREEN}✅ Frontend application started (PID: $FRONTEND_PID)${NC}"

# Summary
echo ""
echo -e "${GREEN}🎉 Workshop environment is ready!${NC}"
echo ""
echo -e "${BLUE}📡 Services:${NC}"
echo -e "  • Solana Validator: http://localhost:8899"
echo -e "  • Backend API: http://localhost:3001"
echo -e "  • Frontend App: http://localhost:3000"
echo ""
echo -e "${YELLOW}🔗 Open your browser to: http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}💡 To stop all services, press Ctrl+C${NC}"

# Wait for interrupt signal
trap 'echo -e "\n${YELLOW}🛑 Shutting down workshop environment...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo -e "${BLUE}💡 Remember to stop the Solana validator manually${NC}"; exit 0' INT

# Keep script running
wait