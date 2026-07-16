#!/bin/bash
# ==========================================
# CSE PunchDad - API Integration Test Script
# Tests the complete flow: Auth → Session → Vote → Payment
# ==========================================

BASE_URL="http://localhost:5001/api"
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Helper function
test_api() {
  local description="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local token="$5"
  local expected_status="$6"

  local headers="-H 'Content-Type: application/json'"
  if [ -n "$token" ]; then
    headers="$headers -H 'Authorization: Bearer $token'"
  fi

  if [ -n "$data" ]; then
    local response=$(eval "curl -s -w '\n%{http_code}' -X $method $headers -d '$data' '$BASE_URL$endpoint'")
  else
    local response=$(eval "curl -s -w '\n%{http_code}' -X $method $headers '$BASE_URL$endpoint'")
  fi

  local http_code=$(echo "$response" | tail -1)
  local body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${NC} [$method] $endpoint - $description (HTTP $http_code)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ FAIL${NC} [$method] $endpoint - $description (Expected $expected_status, got $http_code)"
    echo -e "   Response: $body"
    FAIL=$((FAIL + 1))
  fi

  echo "$body"
}

echo -e "${CYAN}=========================================="
echo "  CSE PunchDad - API Integration Tests"
echo -e "==========================================${NC}\n"

# ==========================================
# 1. AUTH TESTS
# ==========================================
echo -e "${YELLOW}📋 1. AUTH TESTS${NC}"
echo "---"

# 1.1 Register new user
echo -e "\n${CYAN}1.1 Register new user${NC}"
REGISTER_RESULT=$(test_api "Register new user" "POST" "/auth/register" \
  '{"username":"testuser","password":"test123","displayName":"Test User","phone":"0901234568"}' \
  "" "201")
echo ""

# 1.2 Register duplicate (should fail)
echo -e "${CYAN}1.2 Register duplicate user${NC}"
test_api "Register duplicate" "POST" "/auth/register" \
  '{"username":"testuser","password":"test123","displayName":"Test User"}' \
  "" "409"
echo ""

# 1.3 Login as admin
echo -e "${CYAN}1.3 Login as admin${NC}"
LOGIN_RESULT=$(test_api "Login as admin" "POST" "/auth/login" \
  '{"username":"admin","password":"admin123"}' \
  "" "200")
ADMIN_TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo -e "   Token: ${ADMIN_TOKEN:0:30}..."
echo ""

# 1.4 Login as member1
echo -e "${CYAN}1.4 Login as member1${NC}"
LOGIN_M1=$(test_api "Login as member1" "POST" "/auth/login" \
  '{"username":"member1","password":"member123"}' \
  "" "200")
MEMBER1_TOKEN=$(echo "$LOGIN_M1" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo ""

# 1.5 Login as member2
echo -e "${CYAN}1.5 Login as member2${NC}"
LOGIN_M2=$(test_api "Login as member2" "POST" "/auth/login" \
  '{"username":"member2","password":"member123"}' \
  "" "200")
MEMBER2_TOKEN=$(echo "$LOGIN_M2" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo ""

# 1.6 Login as member3
echo -e "${CYAN}1.6 Login as member3${NC}"
LOGIN_M3=$(test_api "Login as member3" "POST" "/auth/login" \
  '{"username":"member3","password":"member123"}' \
  "" "200")
MEMBER3_TOKEN=$(echo "$LOGIN_M3" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo ""

# 1.7 Get me (with token)
echo -e "${CYAN}1.7 Get current user (admin)${NC}"
test_api "Get me" "GET" "/auth/me" "" "$ADMIN_TOKEN" "200"
echo ""

# 1.8 Get me (without token - should fail)
echo -e "${CYAN}1.8 Get me without token${NC}"
test_api "Get me (no auth)" "GET" "/auth/me" "" "" "401"
echo ""

# ==========================================
# 2. SESSION TESTS
# ==========================================
echo -e "\n${YELLOW}📋 2. SESSION TESTS${NC}"
echo "---"

# 2.1 Create session (admin)
echo -e "\n${CYAN}2.1 Create session (admin)${NC}"
CREATE_SESSION=$(test_api "Create session" "POST" "/sessions" \
  '{"title":"Da bong chieu thu 7","playDate":"2026-07-20","startTime":"17:00","endTime":"19:00","location":"San bong ABC","minPlayers":3,"maxPlayers":10}' \
  "$ADMIN_TOKEN" "201")
SESSION_ID=$(echo "$CREATE_SESSION" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "   Session ID: $SESSION_ID"
echo ""

# 2.2 Create session (member - should fail 403)
echo -e "${CYAN}2.2 Create session as member (should fail)${NC}"
test_api "Create session (unauthorized)" "POST" "/sessions" \
  '{"title":"Test","playDate":"2026-07-21","startTime":"17:00","endTime":"19:00","location":"Test","minPlayers":2,"maxPlayers":10}' \
  "$MEMBER1_TOKEN" "403"
echo ""

# 2.3 Get all sessions
echo -e "${CYAN}2.3 Get all sessions${NC}"
test_api "Get sessions" "GET" "/sessions" "" "$ADMIN_TOKEN" "200"
echo ""

# 2.4 Get session by ID
echo -e "${CYAN}2.4 Get session detail${NC}"
test_api "Get session detail" "GET" "/sessions/$SESSION_ID" "" "$ADMIN_TOKEN" "200"
echo ""

# ==========================================
# 3. VOTE TESTS
# ==========================================
echo -e "\n${YELLOW}📋 3. VOTE TESTS${NC}"
echo "---"

# 3.1 Member1 votes JOIN
echo -e "\n${CYAN}3.1 Member1 votes JOIN${NC}"
VOTE1_RESULT=$(test_api "Member1 votes JOIN" "POST" "/votes" \
  "{\"sessionId\":\"$SESSION_ID\",\"status\":\"JOIN\"}" \
  "$MEMBER1_TOKEN" "200")
echo ""

# 3.2 Member2 votes JOIN
echo -e "${CYAN}3.2 Member2 votes JOIN${NC}"
VOTE2_RESULT=$(test_api "Member2 votes JOIN" "POST" "/votes" \
  "{\"sessionId\":\"$SESSION_ID\",\"status\":\"JOIN\"}" \
  "$MEMBER2_TOKEN" "200")
echo ""

# 3.3 Member3 votes JOIN (should trigger auto-confirm, minPlayers=3)
echo -e "${CYAN}3.3 Member3 votes JOIN (should auto-confirm)${NC}"
VOTE3_RESULT=$(test_api "Member3 votes JOIN (auto-confirm)" "POST" "/votes" \
  "{\"sessionId\":\"$SESSION_ID\",\"status\":\"JOIN\"}" \
  "$MEMBER3_TOKEN" "200")
# Check if session was confirmed
if echo "$VOTE3_RESULT" | grep -q '"sessionConfirmed":true'; then
  echo -e "   ${GREEN}✅ Auto-confirm triggered!${NC}"
else
  echo -e "   ${RED}❌ Auto-confirm NOT triggered${NC}"
fi
echo ""

# 3.4 Get session votes
echo -e "${CYAN}3.4 Get session votes summary${NC}"
test_api "Get votes" "GET" "/votes/session/$SESSION_ID" "" "$ADMIN_TOKEN" "200"
echo ""

# 3.5 Verify session status is CONFIRMED
echo -e "${CYAN}3.5 Verify session status = CONFIRMED${NC}"
SESSION_CHECK=$(test_api "Check session confirmed" "GET" "/sessions/$SESSION_ID" "" "$ADMIN_TOKEN" "200")
if echo "$SESSION_CHECK" | grep -q '"status":"CONFIRMED"'; then
  echo -e "   ${GREEN}✅ Session status: CONFIRMED${NC}"
else
  echo -e "   ${RED}❌ Session not CONFIRMED${NC}"
fi
echo ""

# ==========================================
# 4. BOOKING & PAYMENT TESTS
# ==========================================
echo -e "\n${YELLOW}📋 4. BOOKING & PAYMENT TESTS${NC}"
echo "---"

# Get admin user ID
ADMIN_ID=$(echo "$LOGIN_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# 4.1 Admin books session (set payer + total cost → BOOKED)
echo -e "\n${CYAN}4.1 Admin books session (BOOKED + payments created)${NC}"
BOOK_RESULT=$(test_api "Book session" "PUT" "/sessions/$SESSION_ID" \
  "{\"status\":\"BOOKED\",\"totalCost\":300000,\"payerId\":\"$ADMIN_ID\"}" \
  "$ADMIN_TOKEN" "200")
echo ""

# 4.2 Get payments
echo -e "${CYAN}4.2 Get session payments${NC}"
PAYMENTS_RESULT=$(test_api "Get payments" "GET" "/payments/session/$SESSION_ID" "" "$ADMIN_TOKEN" "200")
echo ""

# Extract payment IDs
PAYMENT1_ID=$(echo "$PAYMENTS_RESULT" | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    payments = data.get('payments', [])
    if len(payments) > 0:
        print(payments[0]['id'])
except:
    print('')
" 2>/dev/null)

PAYMENT2_ID=$(echo "$PAYMENTS_RESULT" | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    payments = data.get('payments', [])
    if len(payments) > 1:
        print(payments[1]['id'])
except:
    print('')
" 2>/dev/null)

PAYMENT3_ID=$(echo "$PAYMENTS_RESULT" | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    payments = data.get('payments', [])
    if len(payments) > 2:
        print(payments[2]['id'])
except:
    print('')
" 2>/dev/null)

echo -e "   Payment IDs: $PAYMENT1_ID, $PAYMENT2_ID, $PAYMENT3_ID"

# 4.3 Member1 marks payment as paid
if [ -n "$PAYMENT1_ID" ]; then
  echo -e "\n${CYAN}4.3 Member1 marks payment as PAID${NC}"
  test_api "Mark paid" "PUT" "/payments/$PAYMENT1_ID/mark-paid" "" "$MEMBER1_TOKEN" "200"
  echo ""
fi

# 4.4 Admin confirms payment
if [ -n "$PAYMENT1_ID" ]; then
  echo -e "${CYAN}4.4 Admin confirms payment 1${NC}"
  test_api "Confirm payment" "PUT" "/payments/$PAYMENT1_ID/confirm" "" "$ADMIN_TOKEN" "200"
  echo ""
fi

# 4.5 Confirm remaining payments
if [ -n "$PAYMENT2_ID" ]; then
  echo -e "${CYAN}4.5 Confirm payment 2${NC}"
  test_api "Confirm payment 2" "PUT" "/payments/$PAYMENT2_ID/confirm" "" "$ADMIN_TOKEN" "200"
  echo ""
fi

if [ -n "$PAYMENT3_ID" ]; then
  echo -e "${CYAN}4.6 Confirm payment 3 (should complete session)${NC}"
  LAST_CONFIRM=$(test_api "Confirm last payment" "PUT" "/payments/$PAYMENT3_ID/confirm" "" "$ADMIN_TOKEN" "200")
  if echo "$LAST_CONFIRM" | grep -q '"sessionCompleted":true'; then
    echo -e "   ${GREEN}✅ Session auto-completed!${NC}"
  fi
  echo ""
fi

# 4.7 Final session status check
echo -e "${CYAN}4.7 Final session status check${NC}"
FINAL_CHECK=$(test_api "Final status" "GET" "/sessions/$SESSION_ID" "" "$ADMIN_TOKEN" "200")
FINAL_STATUS=$(echo "$FINAL_CHECK" | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    print(data['session']['status'])
except:
    print('UNKNOWN')
" 2>/dev/null)
echo -e "   Final Status: $FINAL_STATUS"
echo ""

# ==========================================
# 5. CLEANUP
# ==========================================
echo -e "\n${YELLOW}📋 5. EDGE CASES${NC}"
echo "---"

# 5.1 Login with wrong password
echo -e "\n${CYAN}5.1 Login wrong password${NC}"
test_api "Wrong password" "POST" "/auth/login" \
  '{"username":"admin","password":"wrongpass"}' \
  "" "401"
echo ""

# 5.2 Access without token
echo -e "${CYAN}5.2 Access sessions without token${NC}"
test_api "No auth" "GET" "/sessions" "" "" "401"
echo ""

# 5.3 Invalid register data
echo -e "${CYAN}5.3 Register with short password${NC}"
test_api "Short password" "POST" "/auth/register" \
  '{"username":"bad","password":"12","displayName":"Bad User"}' \
  "" "400"
echo ""

# ==========================================
# SUMMARY
# ==========================================
echo -e "\n${CYAN}=========================================="
echo "  TEST SUMMARY"
echo -e "==========================================${NC}"
echo -e "${GREEN}✅ Passed: $PASS${NC}"
echo -e "${RED}❌ Failed: $FAIL${NC}"
TOTAL=$((PASS + FAIL))
echo -e "📊 Total:  $TOTAL"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All tests passed!${NC}"
else
  echo -e "\n${RED}⚠️  Some tests failed. Check output above.${NC}"
fi

# Cleanup test user
echo -e "\n${CYAN}🧹 Note: Test user 'testuser' was created in DB during testing.${NC}"
