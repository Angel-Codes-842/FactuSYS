from django.urls import path
from . import views

urlpatterns = [
    path('eventos/', views.EventoSifenListView.as_view(), name='sifen-eventos'),
    path('configuracion/', views.SifenConfigView, name='sifen-config'),
]
