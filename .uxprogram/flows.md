# Core goal flows (input for effort_calc.py)

FLOW: send-confession | send an anonymous confession from link
STEPS: N M T K*40 M T W:0.5 N

FLOW: view-inbox | view received confessions in inbox
STEPS: N M T

FLOW: offer-mutual-reveal | recipient offers mutual reveal on a confession
STEPS: N T M T W:0.5 N

FLOW: respond-mutual-reveal | sender accepts a mutual reveal offer
STEPS: N M T W:0.5 N

FLOW: onboarding-terms | accept terms and onboard as a new user
STEPS: N M T W:0.5 N
