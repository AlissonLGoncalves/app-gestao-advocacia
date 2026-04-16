#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive Tenant Isolation Tests

Tests that verify the tenant isolation fixes from commits 7948ae7b and 4a6e7ea2
are working correctly. Creates two users with different tenant IDs and verifies
they cannot access each other's data (clients, cases, etc.).
"""

import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000"

# Track test results
results = []
def log_result(test_name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((test_name, passed, detail))
    print(f"  [{status}] {test_name}" + (f" - {detail}" if detail else ""))


def register_user(username, email, password, role="admin"):
    """Register a new user (admin creates a new Tenant automatically)."""
    resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
        "role": role
    })
    return resp


def login_user(username, password):
    """Login and return the access token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    data = resp.json()
    if resp.status_code == 200:
        return data.get("access_token"), data.get("user", {})
    return None, None


def auth_headers(token):
    """Return auth headers with JWT token."""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def create_client(token, nome, cpf_cnpj, tipo_pessoa="PF"):
    """Create a client via API."""
    resp = requests.post(f"{BASE_URL}/api/clientes/", json={
        "nome_razao_social": nome,
        "cpf_cnpj": cpf_cnpj,
        "tipo_pessoa": tipo_pessoa,
        "email": f"{nome.lower().replace(' ', '_')}@test.com"
    }, headers=auth_headers(token))
    return resp


def create_case(token, titulo, cliente_id, numero_processo=None):
    """Create a case via API."""
    payload = {
        "titulo": titulo,
        "cliente_id": cliente_id,
        "status": "Ativo",
        "tipo_acao": "Civel"
    }
    if numero_processo:
        payload["numero_processo"] = numero_processo
    resp = requests.post(f"{BASE_URL}/api/casos/", json=payload, headers=auth_headers(token))
    return resp


def list_clients(token):
    """List all clients for the authenticated user."""
    resp = requests.get(f"{BASE_URL}/api/clientes/", headers=auth_headers(token))
    return resp


def list_cases(token):
    """List all cases for the authenticated user."""
    resp = requests.get(f"{BASE_URL}/api/casos/", headers=auth_headers(token))
    return resp


def get_client_by_id(token, client_id):
    """Get a specific client by ID."""
    resp = requests.get(f"{BASE_URL}/api/clientes/{client_id}", headers=auth_headers(token))
    return resp


def get_case_by_id(token, case_id):
    """Get a specific case by ID."""
    resp = requests.get(f"{BASE_URL}/api/casos/{case_id}", headers=auth_headers(token))
    return resp


def update_client(token, client_id, data):
    """Update a client via API."""
    resp = requests.put(f"{BASE_URL}/api/clientes/{client_id}", json=data, headers=auth_headers(token))
    return resp


def update_case(token, case_id, data):
    """Update a case via API."""
    resp = requests.put(f"{BASE_URL}/api/casos/{case_id}", json=data, headers=auth_headers(token))
    return resp


def delete_client(token, client_id):
    """Delete a client via API."""
    resp = requests.delete(f"{BASE_URL}/api/clientes/{client_id}", headers=auth_headers(token))
    return resp


def delete_case(token, case_id):
    """Delete a case via API."""
    resp = requests.delete(f"{BASE_URL}/api/casos/{case_id}", headers=auth_headers(token))
    return resp


def main():
    print("=" * 70)
    print("TENANT ISOLATION TEST SUITE")
    print("Verifying fixes from commits 7948ae7b, 4a6e7ea2, 68a2e98")
    print("=" * 70)

    # =========================================================================
    # PHASE 1: Register two users (each creates their own tenant)
    # =========================================================================
    print("\n--- PHASE 1: User Registration (Two Separate Tenants) ---")

    resp1 = register_user("escritorio_alpha", "alpha@lawfirm.com", "senha123")
    log_result("Register User A (Escritorio Alpha)", resp1.status_code == 201, f"Status: {resp1.status_code}")

    resp2 = register_user("escritorio_beta", "beta@lawfirm.com", "senha456")
    log_result("Register User B (Escritorio Beta)", resp2.status_code == 201, f"Status: {resp2.status_code}")

    # =========================================================================
    # PHASE 2: Login both users
    # =========================================================================
    print("\n--- PHASE 2: Login Both Users ---")

    token_a, user_a = login_user("escritorio_alpha", "senha123")
    log_result("Login User A", token_a is not None, f"User ID: {user_a.get('id') if user_a else 'N/A'}")

    token_b, user_b = login_user("escritorio_beta", "senha456")
    log_result("Login User B", token_b is not None, f"User ID: {user_b.get('id') if user_b else 'N/A'}")

    if not token_a or not token_b:
        print("\nFATAL: Could not login both users. Aborting.")
        sys.exit(1)

    # =========================================================================
    # PHASE 3: Create data for User A
    # =========================================================================
    print("\n--- PHASE 3: Create Data for User A (Escritorio Alpha) ---")

    resp_ca1 = create_client(token_a, "Cliente Alpha 1", "111.111.111-11")
    log_result("Create Client A1", resp_ca1.status_code == 201, f"Status: {resp_ca1.status_code}")
    client_a1_id = resp_ca1.json().get("id") if resp_ca1.status_code == 201 else None

    resp_ca2 = create_client(token_a, "Cliente Alpha 2", "222.222.222-22")
    log_result("Create Client A2", resp_ca2.status_code == 201, f"Status: {resp_ca2.status_code}")
    client_a2_id = resp_ca2.json().get("id") if resp_ca2.status_code == 201 else None

    if client_a1_id:
        resp_caso_a1 = create_case(token_a, "Caso Alpha 1", client_a1_id, "0001234-11.2026.8.26.0001")
        log_result("Create Case A1", resp_caso_a1.status_code == 201, f"Status: {resp_caso_a1.status_code}")
        case_a1_id = resp_caso_a1.json().get("id") if resp_caso_a1.status_code == 201 else None
    else:
        case_a1_id = None

    if client_a2_id:
        resp_caso_a2 = create_case(token_a, "Caso Alpha 2", client_a2_id, "0005678-22.2026.8.26.0002")
        log_result("Create Case A2", resp_caso_a2.status_code == 201, f"Status: {resp_caso_a2.status_code}")
        case_a2_id = resp_caso_a2.json().get("id") if resp_caso_a2.status_code == 201 else None
    else:
        case_a2_id = None

    # =========================================================================
    # PHASE 4: Create data for User B
    # =========================================================================
    print("\n--- PHASE 4: Create Data for User B (Escritorio Beta) ---")

    resp_cb1 = create_client(token_b, "Cliente Beta 1", "333.333.333-33")
    log_result("Create Client B1", resp_cb1.status_code == 201, f"Status: {resp_cb1.status_code}")
    client_b1_id = resp_cb1.json().get("id") if resp_cb1.status_code == 201 else None

    resp_cb2 = create_client(token_b, "Cliente Beta 2", "444.444.444-44")
    log_result("Create Client B2", resp_cb2.status_code == 201, f"Status: {resp_cb2.status_code}")
    client_b2_id = resp_cb2.json().get("id") if resp_cb2.status_code == 201 else None

    if client_b1_id:
        resp_caso_b1 = create_case(token_b, "Caso Beta 1", client_b1_id, "0009999-33.2026.8.26.0003")
        log_result("Create Case B1", resp_caso_b1.status_code == 201, f"Status: {resp_caso_b1.status_code}")
        case_b1_id = resp_caso_b1.json().get("id") if resp_caso_b1.status_code == 201 else None
    else:
        case_b1_id = None

    # =========================================================================
    # PHASE 5: Verify list isolation (each user sees only their own data)
    # =========================================================================
    print("\n--- PHASE 5: Verify List Isolation ---")

    # User A should see only their 2 clients
    resp_list_a = list_clients(token_a)
    clients_a = resp_list_a.json() if resp_list_a.status_code == 200 else []
    # Handle both list and dict responses
    if isinstance(clients_a, dict):
        clients_a = clients_a.get("clientes", [])
    user_a_client_count = len(clients_a)
    log_result(
        "User A sees only their clients",
        user_a_client_count == 2,
        f"Expected 2 clients, got {user_a_client_count}"
    )

    # Verify none of User B's clients appear in User A's list
    client_names_a = [c.get("nome_razao_social", "") for c in clients_a]
    no_beta_in_alpha = not any("Beta" in name for name in client_names_a)
    log_result(
        "User A does not see User B's clients in list",
        no_beta_in_alpha,
        f"Client names: {client_names_a}"
    )

    # User B should see only their 2 clients
    resp_list_b = list_clients(token_b)
    clients_b = resp_list_b.json() if resp_list_b.status_code == 200 else []
    if isinstance(clients_b, dict):
        clients_b = clients_b.get("clientes", [])
    user_b_client_count = len(clients_b)
    log_result(
        "User B sees only their clients",
        user_b_client_count == 2,
        f"Expected 2 clients, got {user_b_client_count}"
    )

    # Verify none of User A's clients appear in User B's list
    client_names_b = [c.get("nome_razao_social", "") for c in clients_b]
    no_alpha_in_beta = not any("Alpha" in name for name in client_names_b)
    log_result(
        "User B does not see User A's clients in list",
        no_alpha_in_beta,
        f"Client names: {client_names_b}"
    )

    # Verify case list isolation
    resp_cases_a = list_cases(token_a)
    cases_a = resp_cases_a.json() if resp_cases_a.status_code == 200 else []
    if isinstance(cases_a, dict):
        cases_a = cases_a.get("casos", [])
    user_a_case_count = len(cases_a)
    log_result(
        "User A sees only their cases",
        user_a_case_count == 2,
        f"Expected 2 cases, got {user_a_case_count}"
    )

    resp_cases_b = list_cases(token_b)
    cases_b = resp_cases_b.json() if resp_cases_b.status_code == 200 else []
    if isinstance(cases_b, dict):
        cases_b = cases_b.get("casos", [])
    user_b_case_count = len(cases_b)
    log_result(
        "User B sees only their cases",
        user_b_case_count == 1,
        f"Expected 1 case, got {user_b_case_count}"
    )

    # =========================================================================
    # PHASE 6: Cross-tenant access by ID (GET)
    # =========================================================================
    print("\n--- PHASE 6: Cross-Tenant GET Access (Should be Denied) ---")

    # User B tries to GET User A's client by ID
    if client_a1_id:
        resp_cross_get_client = get_client_by_id(token_b, client_a1_id)
        log_result(
            "User B cannot GET User A's client by ID",
            resp_cross_get_client.status_code in (403, 404),
            f"Status: {resp_cross_get_client.status_code} (expected 403 or 404)"
        )

    # User A tries to GET User B's client by ID
    if client_b1_id:
        resp_cross_get_client2 = get_client_by_id(token_a, client_b1_id)
        log_result(
            "User A cannot GET User B's client by ID",
            resp_cross_get_client2.status_code in (403, 404),
            f"Status: {resp_cross_get_client2.status_code} (expected 403 or 404)"
        )

    # User B tries to GET User A's case by ID
    if case_a1_id:
        resp_cross_get_case = get_case_by_id(token_b, case_a1_id)
        log_result(
            "User B cannot GET User A's case by ID",
            resp_cross_get_case.status_code in (403, 404),
            f"Status: {resp_cross_get_case.status_code} (expected 403 or 404)"
        )

    # User A tries to GET User B's case by ID
    if case_b1_id:
        resp_cross_get_case2 = get_case_by_id(token_a, case_b1_id)
        log_result(
            "User A cannot GET User B's case by ID",
            resp_cross_get_case2.status_code in (403, 404),
            f"Status: {resp_cross_get_case2.status_code} (expected 403 or 404)"
        )

    # =========================================================================
    # PHASE 7: Cross-tenant UPDATE (PUT) - Should be denied
    # =========================================================================
    print("\n--- PHASE 7: Cross-Tenant UPDATE Access (Should be Denied) ---")

    # User B tries to UPDATE User A's client
    if client_a1_id:
        resp_cross_update_client = update_client(token_b, client_a1_id, {
            "nome_razao_social": "HACKED BY BETA",
            "email": "hacked@evil.com"
        })
        log_result(
            "User B cannot UPDATE User A's client",
            resp_cross_update_client.status_code in (403, 404),
            f"Status: {resp_cross_update_client.status_code} (expected 403 or 404)"
        )

    # User A tries to UPDATE User B's case
    if case_b1_id:
        resp_cross_update_case = update_case(token_a, case_b1_id, {
            "titulo": "HACKED BY ALPHA"
        })
        log_result(
            "User A cannot UPDATE User B's case",
            resp_cross_update_case.status_code in (403, 404),
            f"Status: {resp_cross_update_case.status_code} (expected 403 or 404)"
        )

    # =========================================================================
    # PHASE 8: Cross-tenant DELETE - Should be denied
    # =========================================================================
    print("\n--- PHASE 8: Cross-Tenant DELETE Access (Should be Denied) ---")

    # User B tries to DELETE User A's client
    if client_a2_id:
        resp_cross_delete_client = delete_client(token_b, client_a2_id)
        log_result(
            "User B cannot DELETE User A's client",
            resp_cross_delete_client.status_code in (403, 404),
            f"Status: {resp_cross_delete_client.status_code} (expected 403 or 404)"
        )

    # User A tries to DELETE User B's case
    if case_b1_id:
        resp_cross_delete_case = delete_case(token_a, case_b1_id)
        log_result(
            "User A cannot DELETE User B's case",
            resp_cross_delete_case.status_code in (403, 404),
            f"Status: {resp_cross_delete_case.status_code} (expected 403 or 404)"
        )

    # =========================================================================
    # PHASE 9: Verify data integrity after cross-tenant attacks
    # =========================================================================
    print("\n--- PHASE 9: Data Integrity After Cross-Tenant Attempts ---")

    # Verify User A's client was NOT modified by User B's attack
    if client_a1_id:
        resp_verify_a1 = get_client_by_id(token_a, client_a1_id)
        if resp_verify_a1.status_code == 200:
            data = resp_verify_a1.json()
            not_hacked = data.get("nome_razao_social") == "Cliente Alpha 1"
            log_result(
                "User A's client data is intact (not modified by B)",
                not_hacked,
                f"Name: {data.get('nome_razao_social')}"
            )
        else:
            log_result("User A's client still accessible", False, f"Status: {resp_verify_a1.status_code}")

    # Verify User A's second client was NOT deleted by User B's attack
    if client_a2_id:
        resp_verify_a2 = get_client_by_id(token_a, client_a2_id)
        log_result(
            "User A's second client still exists (not deleted by B)",
            resp_verify_a2.status_code == 200,
            f"Status: {resp_verify_a2.status_code}"
        )

    # Verify User B's case was NOT deleted by User A's attack
    if case_b1_id:
        resp_verify_b1 = get_case_by_id(token_b, case_b1_id)
        log_result(
            "User B's case still exists (not deleted by A)",
            resp_verify_b1.status_code == 200,
            f"Status: {resp_verify_b1.status_code}"
        )

    # =========================================================================
    # PHASE 10: Dashboard isolation
    # =========================================================================
    print("\n--- PHASE 10: Dashboard Data Isolation ---")

    resp_dash_a = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers(token_a))
    resp_dash_b = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers(token_b))

    if resp_dash_a.status_code == 200 and resp_dash_b.status_code == 200:
        dash_a = resp_dash_a.json()
        dash_b = resp_dash_b.json()

        log_result(
            "Dashboard A shows correct client count",
            dash_a.get("total_clientes") == 2,
            f"Expected 2, got {dash_a.get('total_clientes')}"
        )
        log_result(
            "Dashboard B shows correct client count",
            dash_b.get("total_clientes") == 2,
            f"Expected 2, got {dash_b.get('total_clientes')}"
        )
        log_result(
            "Dashboard A shows correct active case count",
            dash_a.get("casos_ativos") == 2,
            f"Expected 2, got {dash_a.get('casos_ativos')}"
        )
        log_result(
            "Dashboard B shows correct active case count",
            dash_b.get("casos_ativos") == 1,
            f"Expected 1, got {dash_b.get('casos_ativos')}"
        )
    else:
        log_result("Dashboard A accessible", resp_dash_a.status_code == 200, f"Status: {resp_dash_a.status_code}")
        log_result("Dashboard B accessible", resp_dash_b.status_code == 200, f"Status: {resp_dash_b.status_code}")

    # =========================================================================
    # PHASE 11: User B tries to create a case using User A's client ID
    # =========================================================================
    print("\n--- PHASE 11: Cross-Tenant Case Creation with Foreign Client ---")

    if client_a1_id:
        resp_cross_create = create_case(token_b, "Caso Invasor", client_a1_id)
        log_result(
            "User B cannot create case with User A's client ID",
            resp_cross_create.status_code in (403, 404),
            f"Status: {resp_cross_create.status_code} (expected 403 or 404)"
        )

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    total = len(results)
    passed = sum(1 for _, p, _ in results if p)
    failed = sum(1 for _, p, _ in results if not p)

    print(f"Total: {total}  |  Passed: {passed}  |  Failed: {failed}")

    if failed > 0:
        print("\nFailed tests:")
        for name, p, detail in results:
            if not p:
                print(f"  FAIL: {name} - {detail}")

    print("\n" + ("ALL TESTS PASSED!" if failed == 0 else f"{failed} TEST(S) FAILED!"))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
