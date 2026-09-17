import os, json, sys
from dotenv import load_dotenv
load_dotenv('.env')

sys.path.insert(0, '.')
from app.intelligence.detection import run_detection_agent
from app.intelligence.risk import run_risk_agent
from app.intelligence.finance import run_finance_agent
from app.intelligence.decision import run_decision_agent

def test_pipeline():
    sample_text = open('../data/samples/sample_contract_salesforce.txt').read()

    state = {
        'contract_id': 'test-001',
        'org_id': 'org-001',
        'raw_text': sample_text,
        'file_name': 'sample_contract_salesforce.txt',
        'clauses': None,
        'detection_confidence': None,
        'usage_signals': None,
        'risk_output': None,
        'finance_output': None,
        'decision_output': None,
        'requires_approval': False,
        'mcp_tool_calls': [],
        'error': None,
        'route': 'continue',
    }

    print('=== Detection Agent ===')
    state = run_detection_agent(state)
    print('Route:', state['route'])
    print('Clauses:', json.dumps(state.get('clauses'), indent=2))

    if state['route'] == 'continue':
        print('\n=== Risk Agent ===')
        state = run_risk_agent(state)
        print('Risk:', json.dumps(state.get('risk_output'), indent=2))

        print('\n=== Finance Agent ===')
        state = run_finance_agent(state)
        print('Finance:', json.dumps(state.get('finance_output'), indent=2))

        print('\n=== Decision Agent ===')
        state = run_decision_agent(state)
        print('Decision:', json.dumps(state.get('decision_output'), indent=2))

    print('\n=== PIPELINE COMPLETE ===')
