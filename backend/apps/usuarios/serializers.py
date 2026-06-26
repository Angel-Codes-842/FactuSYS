from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Rol

Usuario = get_user_model()


class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = '__all__'


class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    sucursal_nombre = serializers.CharField(source='sucursal.nombre', read_only=True, allow_null=True)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'tipo', 'telefono', 'direccion', 'is_active', 'password',
                  'roles', 'sucursal', 'sucursal_nombre']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        roles = validated_data.pop('roles', None)
        user = Usuario(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        if roles is not None:
            user.roles.set(roles)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        roles = validated_data.pop('roles', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if roles is not None:
            instance.roles.set(roles)
        return instance
