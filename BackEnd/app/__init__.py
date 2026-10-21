"""El Ticketo — API de gestion de tickets."""

import os

# Tag git de la release, inscrit dans l'image Docker (voir cloudbuild.yaml).
__version__ = os.getenv("ELTICKETO_VERSION", "dev")
