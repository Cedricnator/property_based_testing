import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserEntity } from './entities/user.entity';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  private mapUser(user: User): UserEntity {
    const { password, ...rest } = user;
    return rest;
  }

  private async findByEmail(email: string): Promise<UserEntity | null> {
    return await this.prismaService.user.findUnique({
      where: { email: email },
    });
  }

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    const existingUser = await this.findByEmail(createUserDto.email);

    if (existingUser) {
      throw new BadRequestException('Email ya registrado');
    }

    const user = await this.prismaService.user.create({
      data: {
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        password: createUserDto.password,
        isActive: true,
      },
    });
    return this.mapUser(user);
  }

  async findAll(): Promise<UserEntity[]> {
    const users = await this.prismaService.user.findMany();
    return users.map((user) => this.mapUser(user));
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException(`user with id ${id} not found`);
    }

    return this.mapUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    const update = {
      ...user,
      ...updateUserDto,
    };

    const updatedUser = await this.prismaService.user.update({
      where: {
        id: id,
      },
      data: {
        email: update.email,
        firstName: update.firstName,
        lastName: update.lastName,
        password: update.password,
        isActive: update.isActive,
        updatedAt: new Date(),
      },
    });

    return this.mapUser(updatedUser);
  }

  async remove(id: string): Promise<UserEntity> {
    const userToDelete = await this.findOne(id);

    await this.prismaService.user.delete({
      where: {
        id: id,
      },
    });

    return userToDelete;
  }
}
