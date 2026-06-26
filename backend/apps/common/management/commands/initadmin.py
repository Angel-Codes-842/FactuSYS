from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates a default superuser if none exists'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='admin')
        parser.add_argument('--email', default='admin@factusys.local')
        parser.add_argument('--password', default='admin123')

    def handle(self, *args, **options):
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write('Superuser already exists, skipping')
            return

        username = options['username']
        email = options['email']
        password = options['password']

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(
            f'Superuser "{username}" created (password: {password})'
        ))
        self.stdout.write(self.style.WARNING('Change the password after first login'))
