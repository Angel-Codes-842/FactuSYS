from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class AuthAPITestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin', password='admin123', tipo='admin'
        )

    def test_login_success(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'admin', 'password': 'admin123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_invalid_credentials(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'admin', 'password': 'wrong',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token(self):
        login = self.client.post('/api/auth/login/', {
            'username': 'admin', 'password': 'admin123',
        }, format='json')
        refresh = login.data['refresh']
        response = self.client.post('/api/auth/refresh/', {
            'refresh': refresh,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)


class UsuarioAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        User.objects.all().delete()
        self.admin = User.objects.create_user(
            username='testadmin', password='admin123', tipo='admin'
        )
        self.vendedor = User.objects.create_user(
            username='testvendedor', password='vend123', tipo='vendedor'
        )

    def test_list_usuarios_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/usuarios/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_list_usuarios_as_vendedor(self):
        self.client.force_authenticate(user=self.vendedor)
        response = self.client.get('/api/auth/usuarios/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_create_usuario_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/auth/usuarios/', {
            'username': 'nuevo', 'password': 'pass1234',
            'tipo': 'vendedor',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['username'], 'nuevo')
        self.assertNotIn('password', response.data)

    def test_create_usuario_as_vendedor_rechazado(self):
        self.client.force_authenticate(user=self.vendedor)
        response = self.client.post('/api/auth/usuarios/', {
            'username': 'nuevo', 'password': 'pass1234',
            'tipo': 'vendedor',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_usuario_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/auth/usuarios/{self.vendedor.id}/',
            {'first_name': 'NuevoNombre'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'NuevoNombre')

    def test_update_usuario_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/auth/usuarios/{self.vendedor.id}/',
            {'password': 'nuevopass123'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.vendedor.refresh_from_db()
        self.assertTrue(self.vendedor.check_password('nuevopass123'))

    def test_delete_usuario_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        nuevo = User.objects.create_user(username='temp', password='temp123')
        response = self.client.delete(f'/api/auth/usuarios/{nuevo.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_usuario_as_vendedor_rechazado(self):
        self.client.force_authenticate(user=self.vendedor)
        nuevo = User.objects.create_user(username='temp', password='temp123')
        response = self.client.delete(f'/api/auth/usuarios/{nuevo.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_me_endpoint_get(self):
        self.client.force_authenticate(user=self.vendedor)
        response = self.client.get('/api/auth/usuarios/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testvendedor')

    def test_me_endpoint_patch(self):
        self.client.force_authenticate(user=self.vendedor)
        response = self.client.patch('/api/auth/usuarios/me/', {
            'first_name': 'Yo Mismo',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'Yo Mismo')

    def test_search_usuario(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/usuarios/?search=testvendedor')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['username'], 'testvendedor')

    def test_unauthenticated_can_read(self):
        response = self.client.get('/api/auth/usuarios/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
